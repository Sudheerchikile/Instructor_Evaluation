import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentIds, instructorName, instructorEmail } = body;

    if (!Array.isArray(studentIds) || studentIds.length === 0 || !instructorName) {
      return NextResponse.json(
        { success: false, error: 'Student IDs array and instructorName are required.' },
        { status: 400 }
      );
    }

    const result = await prisma.student.updateMany({
      where: {
        id: { in: studentIds },
      },
      data: {
        instructor: instructorName.trim(),
        ...(instructorEmail && { instructorEmail: instructorEmail.trim() }),
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });
  } catch (error: any) {
    console.error('Assign instructor error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
