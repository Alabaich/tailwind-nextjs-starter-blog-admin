import { NextResponse } from 'next/server';
import { checkLogin } from '../../../lib/db';
import { signSession, SESSION_COOKIE, SESSION_TTL_MS } from '../../../lib/session';

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  const user = checkLogin(email, password);
  if (!user) {
    return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
  }
  const token = await signSession({ email: user.email, exp: Date.now() + SESSION_TTL_MS });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}
