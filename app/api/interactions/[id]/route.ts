import { NextRequest } from 'next/server';
import { deleteInteraction, updateInteraction } from '@/db/queries';
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

// Delete a logged interaction, with a required reason. Same permission as editing (checked in deleteInteraction).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async (user) => {
    const { id } = await params;
    const { reason } = (await request.json().catch(() => ({}))) as { reason?: string };
    return Response.json(await deleteInteraction(id, reason ?? '', user));
  }, ['instructor']);
}
