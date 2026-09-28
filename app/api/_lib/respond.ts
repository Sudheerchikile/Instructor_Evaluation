import { NextRequest } from 'next/server';
import { getSessionUser } from '@/db/auth';
import { ForbiddenError, ValidationError } from '@/db/queries';
import { SESSION_COOKIE_NAME } from '@/lib/sessionCookie';
import { InstructorRole, InstructorUser } from '@/lib/types';

async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ValidationError) return Response.json({ error: err.message }, { status: 400 });
    if (err instanceof ForbiddenError) return Response.json({ error: err.message }, { status: 403 });
    console.error(err);
    return Response.json({ error: 'Database request failed.' }, { status: 500 });
  }
}

// Runs `run` for a signed-in user (401 otherwise); `roles` limits which roles may call the route (403 otherwise).
export function withUser(
  request: NextRequest,
  run: (user: InstructorUser) => Promise<Response>,
  roles?: InstructorRole[]
): Promise<Response> {
  return handle(async () => {
    const user = await getSessionUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 });
    if (roles && !roles.includes(user.role)) return Response.json({ error: 'You do not have access to this.' }, { status: 403 });
    return run(user);
  });
}

export { handle };
