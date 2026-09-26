import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const instructorName = searchParams.get('instructorName');
    const search = searchParams.get('q');

    const where: any = {};

    if (studentId) {
      where.studentId = studentId;
    }

    if (instructorName) {
      where.instructorName = { contains: instructorName, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { studentName: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
        { instructorName: { contains: search, mode: 'insensitive' } },
        { topics: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    const interactions = await prisma.interactionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      interactions,
      count: interactions.length,
    });
  } catch (error: any) {
    console.error('Fetch interactions error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      studentId,
      studentName,
      instructorName,
      instructorEmail,
      topics,
      statusPostInteraction,
      rating,
      questionsAsked,
      remarks,
      performedWell,
      improvementAreas,
      tweakedQuestions,
      actionItems,
      meetRecording,
      granolaTranscript,
      interactionRound,
      date,
    } = body;

    if (!studentId || !instructorName) {
      return NextResponse.json(
        { success: false, error: 'studentId and instructorName are required.' },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student not found.' },
        { status: 404 }
      );
    }

    const roundNum = interactionRound || 1;
    const logDate = date || new Date().toISOString().split('T')[0];

    // Compute updated status for the student
    let nextStatus = student.status;
    if (statusPostInteraction === 'Need to Revisit') {
      nextStatus = roundNum === 1
        ? 'Round 1 Revisit — needs retry on Level 0 basics'
        : 'Round 2 Revisit — needs retry before Level 1 promotion';
    } else if (statusPostInteraction === 'Cleared') {
      nextStatus = roundNum >= 2
        ? 'Level 0 Cleared (Rounds 1 & 2 complete) — eligible for Level 1'
        : 'Round 1 Cleared — eligible for Round 2';
    } else {
      nextStatus = `Interaction ${roundNum} In Progress`;
    }

    // Atomic transaction: Create interaction log AND update student state
    const result = await prisma.$transaction(async (tx) => {
      const newLog = await tx.interactionLog.create({
        data: {
          studentId,
          studentName: studentName || student.name,
          instructorName,
          instructorEmail,
          topics: topics || '',
          statusPostInteraction: statusPostInteraction || 'Need to Revisit',
          rating: typeof rating === 'number' ? rating : 0.0,
          questionsAsked: questionsAsked || '',
          remarks: remarks || '',
          performedWell: performedWell || '',
          improvementAreas: improvementAreas || '',
          tweakedQuestions: tweakedQuestions || '',
          actionItems: actionItems || '',
          meetRecording: meetRecording || '',
          granolaTranscript: granolaTranscript || '',
          interactionRound: roundNum,
          date: logDate,
        },
      });

      const updatedStudent = await tx.student.update({
        where: { id: studentId },
        data: {
          interactionCount: { increment: 1 },
          lastInteractionDate: logDate,
          status: nextStatus,
        },
      });

      return { log: newLog, student: updatedStudent };
    });

    return NextResponse.json({
      success: true,
      log: result.log,
      student: result.student,
    });
  } catch (error: any) {
    console.error('Create interaction error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
