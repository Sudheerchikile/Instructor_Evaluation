import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/db/auth';
import { SESSION_COOKIE_NAME } from '@/lib/sessionCookie';
import { handle } from '../../_lib/respond';

export async function POST(request: NextRequest) {
  return handle(async () => {
    await deleteSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  });
}
