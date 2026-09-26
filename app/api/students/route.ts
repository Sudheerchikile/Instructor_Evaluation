import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || searchParams.get('search');
    const instructor = searchParams.get('instructor');
    const level = searchParams.get('level');
    const degree = searchParams.get('degree');

    const where: any = {};

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { hall: { contains: search, mode: 'insensitive' } },
        { section: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (instructor) {
      where.instructor = { contains: instructor, mode: 'insensitive' };
    }

    if (level) {
      where.level = level;
    }

    if (degree) {
      where.degree = degree;
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: { id: 'asc' },
    });

    return NextResponse.json({
      success: true,
      students,
      count: students.length,
    });
  } catch (error: any) {
    console.error('Fetch students error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, degree, section, level, hall, instructor, currentStep, currentTopic } = body;

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: 'Student ID and Name are required.' },
        { status: 400 }
      );
    }

    const existing = await prisma.student.findUnique({
      where: { id: id.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Student with ID "${id}" already exists.` },
        { status: 400 }
      );
    }

    const student = await prisma.student.create({
      data: {
        id: id.trim(),
        name: name.trim(),
        degree: degree?.trim() || 'BITS',
        section: section?.trim() || 'S001',
        level: level || 'Level 0',
        currentStep: currentStep || '1.0 Introduction',
        currentTopic: currentTopic || '1.0 Introduction',
        hall: hall?.trim() || 'Hall 1',
        instructor: instructor?.trim() || 'Unassigned',
        interactionCount: 0,
        status: 'Pending Interaction 1',
      },
    });

    return NextResponse.json({
      success: true,
      student,
    });
  } catch (error: any) {
    console.error('Create student error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
