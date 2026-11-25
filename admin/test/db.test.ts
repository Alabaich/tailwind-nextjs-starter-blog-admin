import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkLogin, getDb } from '@/lib/db';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-db-'));
  vi.stubEnv('DB_PATH', path.join(dir, 'admin.db'));
  vi.stubEnv('ADMIN_EMAIL', 'Admin@Example.com');
  vi.stubEnv('ADMIN_PASSWORD', 'correct horse battery');
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('admin account', () => {
  it('seeds from env and stores a bcrypt hash, never the password', () => {
    const row = getDb().prepare('SELECT email, password_hash FROM users').get() as {
      email: string;
      password_hash: string;
    };
    expect(row.email).toBe('admin@example.com');
    expect(row.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(row.password_hash).not.toContain('correct horse');
  });

  it('accepts the right credentials, case-insensitive on email', async () => {
    expect(await checkLogin('ADMIN@example.com ', 'correct horse battery')).toEqual({
      email: 'admin@example.com',
    });
  });

  it('rejects a wrong password and an unknown email alike', async () => {
    expect(await checkLogin('admin@example.com', 'wrong')).toBeNull();
    expect(await checkLogin('nobody@example.com', 'correct horse battery')).toBeNull();
    expect(await checkLogin("' OR 1=1 --", 'x')).toBeNull();
  });

  it('refuses to seed a placeholder or short password', () => {
    for (const bad of ['change-me', 'short', '']) {
      vi.stubEnv('DB_PATH', path.join(dir, `weak-${bad || 'empty'}.db`));
      vi.stubEnv('ADMIN_PASSWORD', bad);
      expect(() => getDb()).toThrow(/ADMIN_PASSWORD/);
    }
  });

  it('does not re-seed or overwrite an existing account', async () => {
    getDb();
    vi.stubEnv('ADMIN_PASSWORD', 'a different password');
    // Same DB path: the cached handle is reused and the account is untouched.
    expect(await checkLogin('admin@example.com', 'correct horse battery')).not.toBeNull();
    expect(await checkLogin('admin@example.com', 'a different password')).toBeNull();
  });
});
