import { NextRequest } from 'next/server';
import { addInteraction, getInteractions } from '@/db/queries';
import { InteractionLog } from '@/lib/types';
import { withUser } from '../_lib/respond';

// All interactions, latest first (read-only for everyone signed in).
export async function GET(request: NextRequest) {
  return withUser(request, async () => Response.json(await getInteractions()));
}

// Log an interaction. Only the student's assigned instructor may do this (checked in addInteraction).
export async function POST(request: NextRequest) {
  return withUser(request, async (user) => {
    const log = (await request.json()) as InteractionLog;
    return Response.json(await addInteraction(log, user), { status: 201 });
  }, ['instructor']);
}
