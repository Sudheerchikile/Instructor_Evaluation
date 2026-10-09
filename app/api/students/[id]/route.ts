import { NextRequest } from 'next/server';
import { updateStudentProgress } from '@/db/queries';
import { withUser } from '../../_lib/respond';

// Level / topic / subtopic / step change. Only the student's assigned instructor may do this (checked in updateStudentProgress).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async (user) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { level?: unknown; currentTopic?: unknown; currentSubtopic?: unknown; currentStep?: unknown };
    const pick = (value: unknown) => (typeof value === 'string' ? value : undefined);

    const student = await updateStudentProgress(id, {
      level: pick(body.level),
      currentTopic: pick(body.currentTopic),
      // null = no subtopic (topics without subtopics); undefined = not sent (older clients).
      currentSubtopic: body.currentSubtopic === null ? null : pick(body.currentSubtopic),
      currentStep: pick(body.currentStep),
    }, user);
    return student ? Response.json(student) : Response.json({ error: 'Student not found.' }, { status: 404 });
  }, ['instructor']);
}
