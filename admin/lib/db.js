// Uses the built-in node:sqlite (stable since Node 22.13 / 24) — no native
// module compilation, which keeps the Docker build fast and portable.
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || '/data/admin.db';

let db;

function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  seed();
  return db;
}

function seed() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('No users in DB and ADMIN_EMAIL / ADMIN_PASSWORD not set.');
    return;
  }
  db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(
    email.toLowerCase(),
    bcrypt.hashSync(password, 10)
  );
  console.log(`Seeded admin user ${email}`);
}

export function checkLogin(email, password) {
  const row = getDb()
    .prepare('SELECT email, password_hash FROM users WHERE email = ?')
    .get(String(email || '').toLowerCase());
  if (!row) return null;
  return bcrypt.compareSync(String(password || ''), row.password_hash)
    ? { email: row.email }
    : null;
}
