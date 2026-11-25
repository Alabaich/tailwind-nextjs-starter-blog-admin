// Stateless signed session cookie. Web Crypto only, so the same code runs in
// edge middleware and in Node route handlers.
import { sessionSecret } from './env';

export const SESSION_COOKIE = 'bg_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface Session {
  email: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.email === 'string' && typeof v.exp === 'number';
}

export async function signSession(payload: Session): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  try {
    // subtle.verify compares in constant time.
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      b64urlDecode(sig),
      enc.encode(body)
    );
    if (!ok) return null;
    const payload: unknown = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!isSession(payload) || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
