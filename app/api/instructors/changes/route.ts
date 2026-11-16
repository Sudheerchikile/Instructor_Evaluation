import { NextRequest } from 'next/server';
import { getInstructorChanges } from '@/db/queries';
import { withUser } from '../../_lib/respond';

// Who added which instructor and who moved which students, newest first. Admin only.
export async function GET(request: NextRequest) {
  return withUser(request, async () => Response.json(await getInstructorChanges()), ['admin']);
}
