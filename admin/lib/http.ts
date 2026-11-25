import { NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function jsonError(error: string, status: number, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error }, { status, headers });
}

/**
 * CSRF guard for state-changing requests. Browsers attach `Origin` to every
 * cross-origin and every non-GET same-origin request, and a page on another
 * origin cannot forge it. SameSite cookies alone are not enough here: the
 * blog and the admin are the same *site* (same host, different port).
 *
 * `forwardedHost` covers a proxy in front that rewrites Host; a cross-site
 * attacker cannot set that header from a victim's browser either.
 */
export function isSameOrigin(
  method: string,
  origin: string | null,
  host: string | null,
  forwardedHost: string | null = null
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  return originHost !== '' && (originHost === host || originHost === forwardedHost);
}

/**
 * The admin is only reachable through Caddy, which discards client-supplied
 * X-Forwarded-For values and writes the real peer address, so the last hop is
 * the one to trust.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const last = forwarded?.split(',').pop()?.trim();
  return last || 'unknown';
}

export function isHttps(req: Request): boolean {
  return (
    req.headers.get('x-forwarded-proto') === 'https' || new URL(req.url).protocol === 'https:'
  );
}

export class BodyError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Parses a JSON object body with a hard size cap. */
export async function readJsonObject(
  req: Request,
  maxBytes: number
): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new BodyError('Request body too large', 413);
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new BodyError('Request body too large', 413);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BodyError('Invalid JSON body', 400);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BodyError('Expected a JSON object', 400);
  }
  return parsed as Record<string, unknown>;
}
