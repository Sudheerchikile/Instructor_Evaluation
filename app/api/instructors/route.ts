import { NextRequest } from 'next/server';
import { getInstructorList } from '@/db/queries';
import { withUser } from '../_lib/respond';

// Full instructor details with their assigned students. Admin only.
export async function GET(request: NextRequest) {
  return withUser(request, async () => Response.json(await getInstructorList()), ['admin']);
}
