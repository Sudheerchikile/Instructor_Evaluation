import { NextRequest } from 'next/server';
import { updateInteraction } from '@/db/queries';
import { InteractionLog } from '@/lib/types';
import { withUser } from '../../_lib/respond';

// Edit a logged interaction. Assigned instructor or the author only (checked in updateInteraction).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async (user) => {
    const { id } = await params;
    const patch = (await request.json().catch(() => ({}))) as Partial<InteractionLog>;
    return Response.json(await updateInteraction(id, patch, user));
  }, ['instructor']);
}
