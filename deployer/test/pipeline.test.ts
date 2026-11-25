import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Deployer, parseUpstream, upstreamFor } from '../src/pipeline.ts';
import type { Color, Deps, Options, PersistedState } from '../src/pipeline.ts';

const OPTS: Options = {
  healthRetries: 3,
  healthIntervalMs: 1,
  rollbackHealthRetries: 2,
  pruneImages: false,
};

interface Harness {
  deps: Deps;
  calls: string[];
  upstream: { text: string | null };
  state: { value: PersistedState | null };
  /** Substring of a docker command that should fail. */
  failOn: Set<string>;
  health: Record<Color, number | 'down'>;
}

function harness(initial: Color | null = 'blog-blue'): Harness {
  const h: Harness = {
    calls: [],
    upstream: { text: initial ? upstreamFor(initial) : null },
    state: { value: null },
    failOn: new Set(),
    health: { 'blog-blue': 200, 'blog-green': 200 },
    deps: undefined as unknown as Deps,
  };
  let tick = 0;
  h.deps = {
    async docker(args) {
      const cmd = args.join(' ');
      h.calls.push(cmd);
      for (const needle of h.failOn) {
        if (cmd.includes(needle)) throw new Error(`boom: ${needle}`);
      }
    },
    async probe(color) {
      const code = h.health[color];
      if (code === 'down') throw new Error('ECONNREFUSED');
      return code;
    },
    readUpstream: () => h.upstream.text,
    writeUpstream: (text) => {
      h.upstream.text = text;
    },
    readState: () => h.state.value,
    writeState: (s) => {
      h.state.value = structuredClone(s);
    },
    sleep: async () => {},
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
    log: () => {},
  };
  return h;
}

test('parseUpstream accepts only a single known upstream', () => {
  assert.equal(parseUpstream('reverse_proxy blog-green:3000\n'), 'blog-green');
  assert.equal(parseUpstream('reverse_proxy blog-blue:3000'), 'blog-blue');
  assert.equal(parseUpstream('reverse_proxy evil:3000'), null);
  assert.equal(parseUpstream('# blog-green\nreverse_proxy other:3000'), null);
  assert.equal(parseUpstream(''), null);
  assert.equal(parseUpstream(null), null);
});

test('seeds the upstream file when it is missing', () => {
  const h = harness(null);
  const d = new Deployer(h.deps, OPTS);
  assert.equal(h.upstream.text, upstreamFor('blog-blue'));
  assert.equal(d.snapshot().active, 'blog-blue');
  assert.equal(d.snapshot().rollbackTo, null);
});

test('successful deploy builds the standby color, flips, and enables rollback', async () => {
  const h = harness('blog-blue');
  const d = new Deployer(h.deps, OPTS);
  const { result, done } = d.requestRebuild();
  assert.equal(result, 'started');
  assert.equal(d.snapshot().status, 'building');
  await done;

  assert.deepEqual(h.calls, [
    'compose build blog-green',
    'compose up -d --no-deps blog-green',
    'compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile',
  ]);
  const snap = d.snapshot();
  assert.equal(snap.status, 'idle');
  assert.equal(snap.active, 'blog-green');
  assert.equal(snap.rollbackTo, 'blog-blue');
  assert.ok(snap.lastDeployAt);
  assert.ok(snap.activeBuiltAt);
  assert.equal(h.state.value?.previous, 'blog-blue');
});

test('failed build keeps traffic and the rollback slot untouched', async () => {
  const h = harness('blog-blue');
  const d = new Deployer(h.deps, OPTS);
  await d.requestRebuild().done; // blue -> green, rollback slot = blue
  h.failOn.add('compose build');
  await d.requestRebuild().done;

  const snap = d.snapshot();
  assert.equal(snap.status, 'error');
  assert.match(snap.error ?? '', /boom/);
  assert.equal(snap.active, 'blog-green');
  assert.equal(snap.rollbackTo, 'blog-blue');
});

test('unhealthy new build never receives traffic and invalidates rollback', async () => {
  const h = harness('blog-blue');
  const d = new Deployer(h.deps, OPTS);
  await d.requestRebuild().done; // green live, blue is the rollback slot
  h.health['blog-blue'] = 500;
  await d.requestRebuild().done; // rebuilds blue, which comes up broken

  const snap = d.snapshot();
  assert.equal(snap.status, 'error');
  assert.match(snap.error ?? '', /healthcheck timeout for blog-blue/);
  assert.equal(snap.active, 'blog-green');
  // blue was replaced by the broken build: there is nothing to roll back to.
  assert.equal(snap.rollbackTo, null);
  assert.deepEqual(d.requestRollback().result, { ok: false, reason: 'unavailable' });
});

test('a 404 from the new build is not treated as healthy', async () => {
  const h = harness('blog-blue');
  h.health['blog-green'] = 404;
  const d = new Deployer(h.deps, OPTS);
  await d.requestRebuild().done;
  assert.equal(d.snapshot().status, 'error');
  assert.equal(d.snapshot().active, 'blog-blue');
});

test('failed caddy reload restores the upstream file', async () => {
  const h = harness('blog-blue');
  h.failOn.add('caddy reload');
  const d = new Deployer(h.deps, OPTS);
  await d.requestRebuild().done;

  assert.equal(d.snapshot().status, 'error');
  assert.match(d.snapshot().error ?? '', /caddy reload failed/);
  // Caddy still serves blue, and the file must say so.
  assert.equal(h.upstream.text, upstreamFor('blog-blue'));
  assert.equal(d.snapshot().active, 'blog-blue');
});

test('requests arriving mid-build are coalesced into one follow-up run', async () => {
  const h = harness('blog-blue');
  const d = new Deployer(h.deps, OPTS);
  const first = d.requestRebuild();
  assert.equal(d.requestRebuild().result, 'queued');
  assert.equal(d.requestRebuild().result, 'queued');
  assert.equal(d.snapshot().pending, true);
  await first.done;

  const builds = h.calls.filter((c) => c.startsWith('compose build'));
  assert.deepEqual(builds, ['compose build blog-green', 'compose build blog-blue']);
  assert.equal(d.snapshot().pending, false);
  assert.equal(d.snapshot().active, 'blog-blue');
  assert.equal(d.snapshot().status, 'idle');
});

test('rollback flips to the previous release without building', async () => {
  const h = harness('blog-blue');
  const d = new Deployer(h.deps, OPTS);
  await d.requestRebuild().done;
  h.calls.length = 0;

  const { result, done } = d.requestRollback();
  assert.deepEqual(result, { ok: true, to: 'blog-blue' });
  assert.equal(d.snapshot().status, 'rolling-back');
  await done;

  assert.deepEqual(h.calls, [
    'compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile',
  ]);
  const snap = d.snapshot();
  assert.equal(snap.status, 'idle');
  assert.equal(snap.active, 'blog-blue');
  // The release we left is still healthy, so we can switch forward again.
  assert.equal(snap.rollbackTo, 'blog-green');
});

test('rollback is refused when the standby is down, and traffic stays put', async () => {
  const h = harness('blog-blue');
  const d = new Deployer(h.deps, OPTS);
  await d.requestRebuild().done;
  h.health['blog-blue'] = 'down';
  await d.requestRollback().done;

  assert.equal(d.snapshot().status, 'error');
  assert.equal(d.snapshot().active, 'blog-green');
});

test('rollback is unavailable on first boot and while busy', async () => {
  const h = harness('blog-blue');
  const d = new Deployer(h.deps, OPTS);
  assert.deepEqual(d.requestRollback().result, { ok: false, reason: 'unavailable' });
  const { done } = d.requestRebuild();
  assert.deepEqual(d.requestRollback().result, { ok: false, reason: 'busy' });
  await done;
});

test('rollback slot survives a deployer restart', async () => {
  const h = harness('blog-blue');
  await new Deployer(h.deps, OPTS).requestRebuild().done;
  const restarted = new Deployer(h.deps, OPTS);
  assert.equal(restarted.snapshot().active, 'blog-green');
  assert.equal(restarted.snapshot().rollbackTo, 'blog-blue');
});

test('prunes dangling images after a successful deploy only', async () => {
  const h = harness('blog-blue');
  const d = new Deployer(h.deps, { ...OPTS, pruneImages: true });
  await d.requestRebuild().done;
  assert.equal(h.calls.at(-1), 'image prune -f');

  h.calls.length = 0;
  h.failOn.add('compose build');
  await d.requestRebuild().done;
  assert.ok(!h.calls.includes('image prune -f'));
});
