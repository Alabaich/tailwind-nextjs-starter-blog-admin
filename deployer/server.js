// Deployer: the only service with access to the Docker socket.
// Exposes two endpoints on the internal network, both behind DEPLOY_TOKEN:
//   POST /rebuild  -> build the inactive color, healthcheck it, flip Caddy
//   GET  /status   -> { status, active, pending, error, log }
//
// Concurrency model: one pipeline at a time. A rebuild request that arrives
// mid-build sets `pending` and is coalesced into exactly one follow-up run.

const http = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs');

const TOKEN = process.env.DEPLOY_TOKEN;
const STACK_DIR = process.env.STACK_DIR || '/stack';
const UPSTREAM_FILE =
  process.env.UPSTREAM_FILE || `${STACK_DIR}/caddy/upstream/active.caddy`;
const HEALTH_RETRIES = Number(process.env.HEALTH_RETRIES || 60);
const HEALTH_INTERVAL_MS = Number(process.env.HEALTH_INTERVAL_MS || 2000);

if (!TOKEN) {
  console.error('DEPLOY_TOKEN is not set, refusing to start.');
  process.exit(1);
}

let status = 'idle'; // idle | building | error
let pending = false;
let lastError = null;
let lastDeployAt = null;
const log = [];

function push(line) {
  const entry = `[${new Date().toISOString()}] ${line}`;
  console.log(entry);
  log.push(entry);
  if (log.length > 500) log.splice(0, log.length - 500);
}

function activeColor() {
  try {
    const text = fs.readFileSync(UPSTREAM_FILE, 'utf8');
    return text.includes('blog-green') ? 'blog-green' : 'blog-blue';
  } catch {
    return 'blog-blue';
  }
}

function run(args) {
  return new Promise((resolve, reject) => {
    push(`$ docker ${args.join(' ')}`);
    const p = spawn('docker', args, { cwd: STACK_DIR });
    p.stdout.on('data', (d) => push(d.toString().trimEnd()));
    p.stderr.on('data', (d) => push(d.toString().trimEnd()));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`docker ${args[1]} exited ${code}`))
    );
  });
}

async function waitHealthy(target) {
  for (let i = 0; i < HEALTH_RETRIES; i++) {
    try {
      const res = await fetch(`http://${target}:3000/`, { redirect: 'manual' });
      if (res.status < 500) {
        push(`healthcheck ok: ${target} responded ${res.status}`);
        return;
      }
    } catch {
      // container not up yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS));
  }
  throw new Error(`healthcheck timeout for ${target}`);
}

async function pipeline() {
  status = 'building';
  lastError = null;
  const from = activeColor();
  const target = from === 'blog-blue' ? 'blog-green' : 'blog-blue';
  push(`rebuild started: ${from} -> ${target}`);
  try {
    await run(['compose', 'build', target]);
    await run(['compose', 'up', '-d', target]);
    await waitHealthy(target);
    fs.writeFileSync(UPSTREAM_FILE, `reverse_proxy ${target}:3000\n`);
    await run([
      'compose', 'exec', '-T', 'caddy',
      'caddy', 'reload', '--config', '/etc/caddy/Caddyfile',
    ]);
    lastDeployAt = new Date().toISOString();
    push(`live: ${target} (previous ${from} kept running for instant rollback)`);
    status = 'idle';
  } catch (err) {
    status = 'error';
    lastError = err.message;
    push(`ERROR: ${err.message} — ${from} is still serving traffic`);
  }
  if (pending) {
    pending = false;
    push('coalesced rebuild request found, running pipeline again');
    pipeline();
  }
}

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    if ((req.headers.authorization || '') !== `Bearer ${TOKEN}`) {
      return json(res, 401, { error: 'unauthorized' });
    }
    if (req.method === 'POST' && req.url === '/rebuild') {
      if (status === 'building') {
        pending = true;
        return json(res, 202, { queued: true });
      }
      pipeline();
      return json(res, 202, { started: true });
    }
    if (req.method === 'GET' && req.url === '/status') {
      return json(res, 200, {
        status,
        active: activeColor(),
        pending,
        error: lastError,
        lastDeployAt,
        log: log.slice(-60),
      });
    }
    return json(res, 404, { error: 'not found' });
  })
  .listen(8000, () => push('deployer listening on :8000'));
