// Deployer: the only service with access to the Docker socket.
// Internal network only, everything except /healthz behind DEPLOY_TOKEN:
//   POST /rebuild   -> build the standby color, healthcheck it, flip Caddy
//   POST /rollback  -> flip Caddy back to the previous healthy release
//   GET  /status    -> pipeline state + recent log
//   GET  /healthz   -> liveness for the compose healthcheck (no auth, no data)
//
// Runs directly from TypeScript via Node's built-in type stripping, so the
// image needs no build step and no node_modules.

import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isAuthorized, tokenProblem } from './auth.ts';
import { Deployer } from './pipeline.ts';
import type { Color, Deps, PersistedState } from './pipeline.ts';

const TOKEN = process.env.DEPLOY_TOKEN;
const STACK_DIR = process.env.STACK_DIR || '/stack';
const STATE_DIR = process.env.STATE_DIR || '/state';
const UPSTREAM_FILE = path.join(STATE_DIR, 'active.caddy');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const PORT = Number(process.env.PORT || 8000);
const PROBE_TIMEOUT_MS = 5000;
const LOG_LIMIT = 500;

const problem = tokenProblem(TOKEN);
if (problem || !TOKEN) {
  console.error(`${problem}. Refusing to start (run ./setup.sh to generate one).`);
  process.exit(1);
}

const log: string[] = [];

function push(text: string): void {
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const entry = `[${new Date().toISOString()}] ${line}`;
    console.log(entry);
    log.push(entry);
  }
  if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
}

/** Write-then-rename so Caddy never reads a half-written file. */
function writeAtomic(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function readOrNull(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

const deps: Deps = {
  docker(args) {
    return new Promise((resolve, reject) => {
      push(`$ docker ${args.join(' ')}`);
      const child = spawn('docker', args, { cwd: STACK_DIR });
      child.stdout.on('data', (chunk: Buffer) => push(chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => push(chunk.toString()));
      child.on('error', reject);
      child.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`docker ${args.slice(0, 2).join(' ')} exited ${code}`))
      );
    });
  },
  async probe(color: Color) {
    const res = await fetch(`http://${color}:3000/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    await res.body?.cancel();
    return res.status;
  },
  readUpstream: () => readOrNull(UPSTREAM_FILE),
  writeUpstream: (text) => writeAtomic(UPSTREAM_FILE, text),
  readState() {
    const raw = readOrNull(STATE_FILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PersistedState;
    } catch {
      push('state.json is corrupt, starting from a clean state');
      return null;
    }
  },
  writeState: (state) => writeAtomic(STATE_FILE, JSON.stringify(state, null, 2)),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => new Date(),
  log: push,
};

fs.mkdirSync(STATE_DIR, { recursive: true });

const deployer = new Deployer(deps, {
  healthRetries: Number(process.env.HEALTH_RETRIES || 60),
  healthIntervalMs: Number(process.env.HEALTH_INTERVAL_MS || 2000),
  rollbackHealthRetries: 5,
  pruneImages: process.env.PRUNE_IMAGES !== '0',
});

function json(res: http.ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  // Request bodies are never read: drain them so sockets are not left hanging.
  req.resume();
  const route = `${req.method} ${req.url}`;

  if (route === 'GET /healthz') return json(res, 200, { ok: true });

  if (!isAuthorized(req.headers.authorization, TOKEN)) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (route === 'POST /rebuild') {
    const { result } = deployer.requestRebuild();
    return json(res, 202, result === 'queued' ? { queued: true } : { started: true });
  }

  if (route === 'POST /rollback') {
    const { result } = deployer.requestRollback();
    if (result.ok) return json(res, 202, { started: true, to: result.to });
    return json(res, 409, {
      error:
        result.reason === 'busy'
          ? 'A build or rollback is already running'
          : 'No previous healthy release to roll back to',
    });
  }

  if (route === 'GET /status') {
    return json(res, 200, { ...deployer.snapshot(), log: log.slice(-200) });
  }

  return json(res, 404, { error: 'not found' });
});

server.requestTimeout = 10_000;
server.listen(PORT, () => push(`deployer listening on :${PORT}`));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Do not wait forever on keep-alive connections.
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
