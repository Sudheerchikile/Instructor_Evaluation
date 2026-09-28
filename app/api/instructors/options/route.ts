import { NextRequest } from 'next/server';
import { getInstructorOptions } from '@/db/queries';
import { withUser } from '../../_lib/respond';

// Instructor names and ids for the "Interaction Taken By" dropdown. Any signed-in user.
export async function GET(request: NextRequest) {
  return withUser(request, async () => Response.json(await getInstructorOptions()));
}
