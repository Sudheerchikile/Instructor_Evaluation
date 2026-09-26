import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.interactionLog.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Interaction log deleted' });
  } catch (error: any) {
    console.error('Delete interaction error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
