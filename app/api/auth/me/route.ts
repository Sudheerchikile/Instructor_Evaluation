import { NextRequest } from 'next/server';
import { withUser } from '../../_lib/respond';

// Current signed-in user (401 when the session is missing or expired).
export async function GET(request: NextRequest) {
  return withUser(request, async (user) => Response.json(user));
}
