import { describe, expect, it } from 'vitest';
import { RateLimiter } from '@/lib/rate-limit';

function setup(max = 3, windowMs = 60_000, maxKeys = 10_000) {
  const clock = { t: 1_000_000 };
  return { clock, limiter: new RateLimiter(max, windowMs, () => clock.t, maxKeys) };
}

describe('RateLimiter', () => {
  it('allows up to max failures, then blocks', () => {
    const { limiter } = setup();
    for (let i = 0; i < 3; i++) {
      expect(limiter.retryAfter('ip')).toBe(0);
      limiter.record('ip');
    }
    expect(limiter.retryAfter('ip')).toBe(60);
  });

  it('counts keys independently', () => {
    const { limiter } = setup(1);
    limiter.record('a');
    expect(limiter.retryAfter('a')).toBeGreaterThan(0);
    expect(limiter.retryAfter('b')).toBe(0);
  });

  it('unblocks as the window slides', () => {
    const { limiter, clock } = setup();
    limiter.record('ip');
    clock.t += 30_000;
    limiter.record('ip');
    limiter.record('ip');
    expect(limiter.retryAfter('ip')).toBe(30);
    clock.t += 30_001;
    expect(limiter.retryAfter('ip')).toBe(0);
  });

  it('reset clears the counter (successful login)', () => {
    const { limiter } = setup(1);
    limiter.record('ip');
    limiter.reset('ip');
    expect(limiter.retryAfter('ip')).toBe(0);
  });

  it('stays bounded when flooded with distinct keys', () => {
    const { limiter } = setup(3, 60_000, 100);
    for (let i = 0; i < 1000; i++) limiter.record(`ip-${i}`);
    const size = (limiter as unknown as { hits: Map<string, number[]> }).hits.size;
    expect(size).toBeLessThanOrEqual(100);
    // The most recent offender is still tracked.
    limiter.record('ip-999');
    limiter.record('ip-999');
    expect(limiter.retryAfter('ip-999')).toBeGreaterThan(0);
  });
});
