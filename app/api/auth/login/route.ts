import { NextRequest, NextResponse } from 'next/server';
import { authenticate, createSession } from '@/db/auth';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/sessionCookie';
import { handle } from '../../_lib/respond';

// Email + password sign-in. Only accounts loaded by `npm run db:users` exist.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) return Response.json({ error: 'Enter your email and password.' }, { status: 400 });

    const user = await authenticate(email, password);
    if (!user) return Response.json({ error: 'Incorrect email or password.' }, { status: 401 });

    const response = NextResponse.json(user);
    response.cookies.set(SESSION_COOKIE_NAME, await createSession(user.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  });
}
