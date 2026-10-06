import { NextRequest } from 'next/server';
import { getLevelConversions } from '@/db/queries';
import { withUser } from '../../_lib/respond';

// Level conversions (students moving up a level), per day. Read-only for everyone signed in.
export async function GET(request: NextRequest) {
  return withUser(request, async () => {
    try {
      return Response.json(await getLevelConversions());
    } catch (err) {
      // 42P01 = undefined table: `npm run db:migrate` has not created level_changes yet.
      if ((err as { code?: string }).code === '42P01') {
        return Response.json({ error: 'Level conversion tracking is not set up yet (run npm run db:migrate).' }, { status: 503 });
      }
      throw err;
    }
  });
}
