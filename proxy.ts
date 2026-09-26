import { NextRequest, NextResponse } from 'next/server';

// Must match AUTH_COOKIE_NAME in lib/storage.ts
const AUTH_COOKIE_NAME = 'kkh_auth_session';

// Public routes that do not require authentication
const PUBLIC_ROUTES = ['/login'];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    const loginUrl = new URL('/login', req.nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
