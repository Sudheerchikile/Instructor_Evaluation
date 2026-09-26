import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        interactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, student });
  } catch (error: any) {
    console.error('Fetch student by ID error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.student.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.degree !== undefined && { degree: body.degree }),
        ...(body.section !== undefined && { section: body.section }),
        ...(body.level !== undefined && { level: body.level }),
        ...(body.currentStep !== undefined && { currentStep: body.currentStep }),
        ...(body.currentTopic !== undefined && { currentTopic: body.currentTopic }),
        ...(body.hall !== undefined && { hall: body.hall }),
        ...(body.instructor !== undefined && { instructor: body.instructor }),
        ...(body.instructorEmail !== undefined && { instructorEmail: body.instructorEmail }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.interactionCount !== undefined && { interactionCount: body.interactionCount }),
        ...(body.lastInteractionDate !== undefined && { lastInteractionDate: body.lastInteractionDate }),
      },
    });

    return NextResponse.json({ success: true, student: updated });
  } catch (error: any) {
    console.error('Update student error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.student.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Student deleted successfully' });
  } catch (error: any) {
    console.error('Delete student error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
