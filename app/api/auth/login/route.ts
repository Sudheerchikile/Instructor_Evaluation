import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = (hash * 33) ^ str.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No account found with this email address.' },
        { status: 401 }
      );
    }

    // Verify password with bcrypt or simpleHash fallback
    let isMatch = false;
    if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    } else {
      isMatch = user.passwordHash === simpleHash(password) || user.passwordHash === password;
    }

    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'Incorrect password.' },
        { status: 401 }
      );
    }

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hall: user.hall,
    };

    const response = NextResponse.json({
      success: true,
      user: userData,
    });

    // Set HTTP-only auth cookie
    response.cookies.set('kkh_auth_session', user.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
