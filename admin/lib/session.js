// Stateless signed session cookie. Web Crypto only, so the same code runs in
// edge middleware and in node API routes.

const COOKIE = 'bg_session';
const enc = new TextEncoder();

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSession(payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      b64urlDecode(sig),
      enc.encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
