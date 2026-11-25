import { createHash, timingSafeEqual } from 'node:crypto';

const PLACEHOLDERS = new Set(['replace-with-random-hex', 'change-me', 'changeme']);
const MIN_TOKEN_LENGTH = 32;

/** Returns a reason the token is unusable, or null when it is acceptable. */
export function tokenProblem(token: string | undefined): string | null {
  if (!token) return 'DEPLOY_TOKEN is not set';
  if (PLACEHOLDERS.has(token)) return 'DEPLOY_TOKEN is still the placeholder value';
  if (token.length < MIN_TOKEN_LENGTH) {
    return `DEPLOY_TOKEN must be at least ${MIN_TOKEN_LENGTH} characters`;
  }
  return null;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * Constant-time bearer check. Both sides are hashed first so the comparison
 * neither leaks the token length nor throws on a length mismatch.
 */
export function isAuthorized(header: string | undefined, token: string): boolean {
  if (!header) return false;
  return timingSafeEqual(digest(header), digest(`Bearer ${token}`));
}
