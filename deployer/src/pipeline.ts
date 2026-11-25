// Blue-green pipeline. Pure orchestration: every side effect (docker, HTTP
// probes, the upstream file, the clock) is injected through `Deps`, so the
// whole state machine is unit-tested without Docker.

export type Color = 'blog-blue' | 'blog-green';
export type Status = 'idle' | 'building' | 'rolling-back' | 'error';

export const COLORS: readonly Color[] = ['blog-blue', 'blog-green'];

export interface PersistedState {
  /** Color holding the previous healthy release, i.e. the rollback target. */
  previous: Color | null;
  /** When the content baked into each color was snapshotted (build start). */
  builtAt: Record<Color, string | null>;
  lastDeployAt: string | null;
}

export interface Deps {
  /** Runs `docker <args>` in the stack directory; rejects on non-zero exit. */
  docker(args: string[]): Promise<void>;
  /** Returns the HTTP status of the color's root page; rejects if unreachable. */
  probe(color: Color): Promise<number>;
  readUpstream(): string | null;
  writeUpstream(text: string): void;
  readState(): PersistedState | null;
  writeState(state: PersistedState): void;
  sleep(ms: number): Promise<void>;
  now(): Date;
  log(line: string): void;
}

export interface Options {
  healthRetries: number;
  healthIntervalMs: number;
  /** Retries when checking the standby color before a rollback. */
  rollbackHealthRetries: number;
  pruneImages: boolean;
}

export interface Snapshot {
  status: Status;
  active: Color;
  pending: boolean;
  error: string | null;
  lastDeployAt: string | null;
  /** Build-start time of the release that is live right now. */
  activeBuiltAt: string | null;
  /** Color a rollback would switch to, or null when none is available. */
  rollbackTo: Color | null;
}

export type RollbackResult =
  | { ok: true; to: Color }
  | { ok: false; reason: 'busy' | 'unavailable' };

const UPSTREAM_RE = /^\s*reverse_proxy\s+(blog-blue|blog-green):3000\s*$/m;

export function otherColor(color: Color): Color {
  return color === 'blog-blue' ? 'blog-green' : 'blog-blue';
}

export function upstreamFor(color: Color): string {
  return `reverse_proxy ${color}:3000\n`;
}

/** Strict parse: anything but a single known upstream is treated as unknown. */
export function parseUpstream(text: string | null): Color | null {
  const match = text ? UPSTREAM_RE.exec(text) : null;
  return match ? (match[1] as Color) : null;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class Deployer {
  private status: Status = 'idle';
  private pending = false;
  private error: string | null = null;
  private state: PersistedState;
  private readonly deps: Deps;
  private readonly opts: Options;

  constructor(deps: Deps, opts: Options) {
    this.deps = deps;
    this.opts = opts;
    const saved = deps.readState();
    // First boot: both colors were just built by `docker compose up --build`,
    // so "now" is a fair approximation of their content snapshot time.
    const boot = deps.now().toISOString();
    this.state = saved ?? {
      previous: null,
      builtAt: { 'blog-blue': boot, 'blog-green': boot },
      lastDeployAt: null,
    };
    if (parseUpstream(deps.readUpstream()) === null) {
      deps.log('no valid upstream file found, seeding it with blog-blue');
      deps.writeUpstream(upstreamFor('blog-blue'));
    }
    if (!saved) deps.writeState(this.state);
  }

  active(): Color {
    return parseUpstream(this.deps.readUpstream()) ?? 'blog-blue';
  }

  snapshot(): Snapshot {
    const active = this.active();
    return {
      status: this.status,
      active,
      pending: this.pending,
      error: this.error,
      lastDeployAt: this.state.lastDeployAt,
      activeBuiltAt: this.state.builtAt[active],
      rollbackTo: this.rollbackTarget(active),
    };
  }

  private busy(): boolean {
    return this.status === 'building' || this.status === 'rolling-back';
  }

  private rollbackTarget(active: Color): Color | null {
    const { previous } = this.state;
    return previous && previous !== active ? previous : null;
  }

  private save(patch: Partial<PersistedState>): void {
    this.state = { ...this.state, ...patch };
    this.deps.writeState(this.state);
  }

  /**
   * Starts a rebuild, or coalesces it into exactly one follow-up run when a
   * pipeline is already in flight. The returned promise settles when the
   * pipeline (including any coalesced run) is finished; it never rejects.
   */
  requestRebuild(): { result: 'started' | 'queued'; done: Promise<void> } {
    if (this.busy()) {
      this.pending = true;
      return { result: 'queued', done: Promise.resolve() };
    }
    this.status = 'building';
    return { result: 'started', done: this.rebuildLoop() };
  }

  requestRollback(): { result: RollbackResult; done: Promise<void> } {
    if (this.busy()) {
      return { result: { ok: false, reason: 'busy' }, done: Promise.resolve() };
    }
    const from = this.active();
    const to = this.rollbackTarget(from);
    if (!to) {
      return { result: { ok: false, reason: 'unavailable' }, done: Promise.resolve() };
    }
    this.status = 'rolling-back';
    return { result: { ok: true, to }, done: this.rollback(from, to) };
  }

  private async rebuildLoop(): Promise<void> {
    do {
      this.pending = false;
      this.status = 'building';
      await this.deployOnce();
      if (this.pending) this.deps.log('coalesced rebuild request found, running again');
    } while (this.pending);
  }

  private async deployOnce(): Promise<void> {
    const { deps } = this;
    this.error = null;
    const from = this.active();
    const target = otherColor(from);
    const startedAt = deps.now().toISOString();
    deps.log(`rebuild started: ${from} -> ${target}`);
    try {
      // A failed build leaves the standby container untouched, so the
      // rollback slot survives it.
      await deps.docker(['compose', 'build', target]);
      // From here on the standby container is replaced: it no longer holds
      // the previous release, whatever happens next.
      this.save({ previous: null, builtAt: { ...this.state.builtAt, [target]: null } });
      await deps.docker(['compose', 'up', '-d', '--no-deps', target]);
      await this.waitHealthy(target, this.opts.healthRetries);
      await this.switchTo(target, from);
      const finishedAt = deps.now().toISOString();
      this.save({
        previous: from,
        builtAt: { ...this.state.builtAt, [target]: startedAt },
        lastDeployAt: finishedAt,
      });
      deps.log(`live: ${target} (${from} kept running for instant rollback)`);
      this.status = 'idle';
    } catch (err) {
      this.status = 'error';
      this.error = message(err);
      deps.log(`ERROR: ${this.error} - ${from} is still serving traffic`);
      return;
    }
    if (this.opts.pruneImages) {
      // Dangling layers from superseded builds. Images still used by a
      // container (including the rollback slot) are never touched by prune.
      try {
        await deps.docker(['image', 'prune', '-f']);
      } catch (err) {
        deps.log(`image prune failed (ignored): ${message(err)}`);
      }
    }
  }

  private async rollback(from: Color, to: Color): Promise<void> {
    const { deps } = this;
    this.error = null;
    deps.log(`rollback started: ${from} -> ${to}`);
    try {
      await this.waitHealthy(to, this.opts.rollbackHealthRetries);
      await this.switchTo(to, from);
      // The release we just left is healthy, so it becomes the new standby:
      // rolling "back" again switches forward to it.
      this.save({ previous: from });
      deps.log(`live: ${to} (rolled back from ${from})`);
      this.status = 'idle';
    } catch (err) {
      this.status = 'error';
      this.error = message(err);
      deps.log(`ERROR: rollback failed: ${this.error} - ${from} is still serving traffic`);
    }
  }

  private async waitHealthy(target: Color, retries: number): Promise<void> {
    const { deps } = this;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const code = await deps.probe(target);
        // A 404 or 500 from the new build is not a healthy site.
        if (code >= 200 && code < 400) {
          deps.log(`healthcheck ok: ${target} responded ${code}`);
          return;
        }
        deps.log(`healthcheck: ${target} responded ${code}, retrying`);
      } catch {
        // container not accepting connections yet
      }
      if (attempt < retries - 1) await deps.sleep(this.opts.healthIntervalMs);
    }
    throw new Error(`healthcheck timeout for ${target}`);
  }

  /**
   * Points Caddy at `target`. If the reload fails, Caddy is still serving
   * `from`, so the upstream file is restored to match reality. Otherwise the
   * next deploy would rebuild the color that is actually live.
   */
  private async switchTo(target: Color, from: Color): Promise<void> {
    const { deps } = this;
    deps.writeUpstream(upstreamFor(target));
    try {
      await deps.docker([
        'compose', 'exec', '-T', 'caddy',
        'caddy', 'reload', '--config', '/etc/caddy/Caddyfile',
      ]);
    } catch (err) {
      deps.writeUpstream(upstreamFor(from));
      throw new Error(`caddy reload failed (${message(err)})`);
    }
  }
}
