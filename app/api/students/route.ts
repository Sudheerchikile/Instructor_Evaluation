import { NextRequest } from 'next/server';
import { getStudents } from '@/db/queries';
import { withUser } from '../_lib/respond';

// All students, read-only for everyone signed in (directory, analytics). "My Students" filters in the UI.
export async function GET(request: NextRequest) {
  return withUser(request, async () => Response.json(await getStudents()));
}
