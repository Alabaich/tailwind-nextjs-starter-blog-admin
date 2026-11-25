import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isSameOrigin } from './lib/http';
import { verifySession, SESSION_COOKIE } from './lib/session';

const PUBLIC_PATHS = new Set(['/login', '/api/login']);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  // CSRF: reject state-changing requests that do not come from our own pages.
  // Applies to /api/login too, which blocks login CSRF.
  const sameOrigin = isSameOrigin(
    req.method,
    req.headers.get('origin'),
    req.headers.get('host'),
    req.headers.get('x-forwarded-host')
  );
  if (!sameOrigin) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC_PATHS.has(pathname)) {
    if (session && pathname === '/login') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (session) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
