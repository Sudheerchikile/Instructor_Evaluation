import { NextRequest } from 'next/server';
import { assignStudentsToInstructor } from '@/db/queries';
import { withUser } from '../../../_lib/respond';

// Assign students (by roll number) to an existing instructor, moving them from their current one. Admin only.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async () => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { studentIds?: unknown };
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds.map(String) : [];
    return Response.json(await assignStudentsToInstructor(id, studentIds));
  }, ['admin']);
}
