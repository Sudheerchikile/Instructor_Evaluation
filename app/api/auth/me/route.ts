import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('kkh_auth_session')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hall: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, user: null });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Auth me error:', error);
    return NextResponse.json({ success: false, user: null }, { status: 500 });
  }
}
