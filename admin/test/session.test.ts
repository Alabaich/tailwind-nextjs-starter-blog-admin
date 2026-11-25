import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signSession, verifySession } from '@/lib/session';

const SECRET = 's'.repeat(64);

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const future = () => Date.now() + 60_000;

describe('session cookie', () => {
  it('round-trips a valid session', async () => {
    const token = await signSession({ email: 'a@b.c', exp: future() });
    expect(await verifySession(token)).toMatchObject({ email: 'a@b.c' });
  });

  it('rejects a tampered payload', async () => {
    const token = await signSession({ email: 'a@b.c', exp: future() });
    const [, sig] = token.split('.');
    const forged = btoa(JSON.stringify({ email: 'evil@b.c', exp: future() }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(await verifySession(`${forged}.${sig}`)).toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signSession({ email: 'a@b.c', exp: future() });
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(64));
    expect(await verifySession(token)).toBeNull();
  });

  it('rejects expired sessions', async () => {
    vi.useFakeTimers();
    const token = await signSession({ email: 'a@b.c', exp: Date.now() + 1000 });
    vi.advanceTimersByTime(1001);
    expect(await verifySession(token)).toBeNull();
  });

  it.each([undefined, '', 'nodot', 'a.b.c', '.', 'a.', '.b', '%%%.%%%'])(
    'rejects malformed token %j',
    async (token) => {
      expect(await verifySession(token)).toBeNull();
    }
  );

  it('rejects a correctly signed payload of the wrong shape', async () => {
    const token = await signSession({ exp: future() } as never);
    expect(await verifySession(token)).toBeNull();
  });

  it('refuses to sign with a missing, placeholder or short secret', async () => {
    for (const bad of ['', 'replace-with-random-hex', 'short']) {
      vi.stubEnv('SESSION_SECRET', bad);
      await expect(signSession({ email: 'a@b.c', exp: future() })).rejects.toThrow(
        /SESSION_SECRET/
      );
      // ...and never accepts anything "verified" with it.
      expect(await verifySession('e30.AAAA')).toBeNull();
    }
  });
});
