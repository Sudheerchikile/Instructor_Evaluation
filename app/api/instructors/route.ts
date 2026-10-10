import { NextRequest } from 'next/server';
import { createInstructor, getInstructorList } from '@/db/queries';
import { NewInstructorInput } from '@/lib/types';
import { withUser } from '../_lib/respond';

// Full instructor details with their assigned students. Admins and senior instructors (read-only).
export async function GET(request: NextRequest) {
  return withUser(request, async (user) => {
    if (user.role !== 'admin' && !user.isSenior) return Response.json({ error: 'You do not have access to this.' }, { status: 403 });
    return Response.json(await getInstructorList());
  }, ['admin', 'instructor']);
}

// Add an instructor (login + assigned students). Admin only.
export async function POST(request: NextRequest) {
  return withUser(request, async () => {
    const body = (await request.json().catch(() => ({}))) as Partial<NewInstructorInput>;
    const result = await createInstructor({
      name: String(body.name ?? ''),
      firstName: String(body.firstName ?? ''),
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
      studentIds: Array.isArray(body.studentIds) ? body.studentIds.map(String) : [],
    });
    return Response.json(result, { status: 201 });
  }, ['admin']);
}
