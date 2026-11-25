/**
 * In-memory sliding-window limiter for failed attempts. Process-local, which
 * is exactly right for a single-container admin; it resets on restart.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly max: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly maxKeys: number;

  constructor(max: number, windowMs: number, now: () => number = Date.now, maxKeys = 10_000) {
    this.max = max;
    this.windowMs = windowMs;
    this.now = now;
    this.maxKeys = maxKeys;
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  /** Seconds until `key` may try again; 0 when it is allowed right now. */
  retryAfter(key: string): number {
    const list = this.recent(key);
    if (list.length < this.max) return 0;
    const oldest = list[list.length - this.max] ?? this.now();
    return Math.max(1, Math.ceil((oldest + this.windowMs - this.now()) / 1000));
  }

  record(key: string): void {
    const list = this.recent(key);
    list.push(this.now());
    this.hits.set(key, list);
    if (this.hits.size > this.maxKeys) this.prune();
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  /** Bounds memory when many distinct keys (spoofed or real) show up. */
  private prune(): void {
    for (const key of [...this.hits.keys()]) this.recent(key);
    // Still over the cap: drop the oldest keys (Map keeps insertion order).
    for (const key of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break;
      this.hits.delete(key);
    }
  }
}

const globalForLimiter = globalThis as typeof globalThis & { __loginLimiter?: RateLimiter };

/** 10 failed logins per client IP per 15 minutes. */
export const loginLimiter: RateLimiter = (globalForLimiter.__loginLimiter ??= new RateLimiter(
  10,
  15 * 60 * 1000
));
