import { NextResponse } from 'next/server';
import { checkLogin, MAX_PASSWORD_LENGTH } from '@/lib/db';
import { BodyError, clientIp, isHttps, jsonError, readJsonObject } from '@/lib/http';
import { loginLimiter } from '@/lib/rate-limit';
import { signSession, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/session';

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const wait = loginLimiter.retryAfter(ip);
  if (wait > 0) {
    return jsonError('Too many failed attempts. Try again later.', 429, {
      'retry-after': String(wait),
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(req, 4096);
  } catch (err) {
    if (err instanceof BodyError) return jsonError(err.message, err.status);
    throw err;
  }
  const { email, password } = body;
  const wellFormed =
    typeof email === 'string' &&
    typeof password === 'string' &&
    email.length <= 254 &&
    password.length <= MAX_PASSWORD_LENGTH;

  const user = wellFormed ? await checkLogin(email, password) : null;
  if (!user) {
    loginLimiter.record(ip);
    // One message for every failure: never reveal which part was wrong.
    return jsonError('Wrong email or password', 401);
  }
  loginLimiter.reset(ip);

  const token = await signSession({ email: user.email, exp: Date.now() + SESSION_TTL_MS });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(req),
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}
