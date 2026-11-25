// Uses the built-in node:sqlite (stable since Node 22.13 / 24) — no native
// module compilation, which keeps the Docker build fast and portable.
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { passwordProblem } from './env';

const BCRYPT_COST = 12;
/** bcrypt only reads the first 72 bytes; cap input so huge bodies cost nothing. */
export const MAX_PASSWORD_LENGTH = 256;

interface Cache {
  db?: DatabaseSync;
  path?: string;
  dummyHash?: string;
}

// Survives Next.js dev-mode module reloads.
const cache: Cache = ((globalThis as typeof globalThis & { __adminDb?: Cache }).__adminDb ??= {});

export function getDb(): DatabaseSync {
  const dbPath = process.env.DB_PATH || '/data/admin.db';
  if (cache.db && cache.path === dbPath) return cache.db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  seed(db);
  cache.db = db;
  cache.path = dbPath;
  return db;
}

/** First boot only: creates the admin account from the environment. */
function seed(db: DatabaseSync): void {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (row.n > 0) return;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email) throw new Error('No admin account exists yet and ADMIN_EMAIL is not set');
  const problem = passwordProblem(password);
  if (problem || !password) {
    throw new Error(`No admin account exists yet and ${problem}. Set a real one in .env`);
  }
  db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(
    email,
    bcrypt.hashSync(password, BCRYPT_COST)
  );
  console.log(`Seeded admin user ${email}`);
}

export async function checkLogin(
  email: string,
  password: string
): Promise<{ email: string } | null> {
  const row = getDb()
    .prepare('SELECT email, password_hash FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as { email: string; password_hash: string } | undefined;
  // Always run one bcrypt comparison, so response time does not reveal
  // whether the email exists.
  cache.dummyHash ??= bcrypt.hashSync('timing-equalizer', BCRYPT_COST);
  const ok = await bcrypt.compare(password, row?.password_hash ?? cache.dummyHash);
  return row && ok ? { email: row.email } : null;
}
