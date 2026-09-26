import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const instructors = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hall: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    const students = await prisma.student.findMany({
      select: {
        instructor: true,
        hall: true,
        level: true,
        interactionCount: true,
        status: true,
      },
    });

    // Aggregate summary metrics per instructor
    const map = new Map<
      string,
      {
        email: string;
        assigned: number;
        completed: number;
        revisit: number;
        cleared: number;
        halls: Set<string>;
        levels: Set<string>;
      }
    >();

    for (const inst of instructors) {
      map.set(inst.name.toLowerCase(), {
        email: inst.email,
        assigned: 0,
        completed: 0,
        revisit: 0,
        cleared: 0,
        halls: new Set(inst.hall ? [inst.hall] : []),
        levels: new Set(),
      });
    }

    for (const s of students) {
      const instName = (s.instructor || 'Unassigned').trim().toLowerCase();
      if (!map.has(instName)) {
        map.set(instName, {
          email: '',
          assigned: 0,
          completed: 0,
          revisit: 0,
          cleared: 0,
          halls: new Set(),
          levels: new Set(),
        });
      }
      const entry = map.get(instName)!;
      entry.assigned++;
      if (s.hall) entry.halls.add(s.hall);
      if (s.level) entry.levels.add(s.level);
      if (s.interactionCount > 0) {
        entry.completed++;
        if (s.status.includes('Revisit')) entry.revisit++;
        else if (s.status.includes('Cleared')) entry.cleared++;
      }
    }

    const summaries = Array.from(map.entries())
      .map(([nameKey, d]) => {
        const foundUser = instructors.find((i) => i.name.toLowerCase() === nameKey);
        const displayName = foundUser ? foundUser.name : nameKey.replace(/\b\w/g, (l) => l.toUpperCase());
        return {
          name: displayName,
          email: d.email || (foundUser ? foundUser.email : undefined),
          assignedCount: d.assigned,
          completedCount: d.completed,
          revisitCount: d.revisit,
          clearedCount: d.cleared,
          primaryHall: Array.from(d.halls).join(', ') || 'N/A',
          levels: Array.from(d.levels),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      instructors,
      summaries,
    });
  } catch (error: any) {
    console.error('Fetch instructors error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
