import { Student, InteractionLog, InstructorSummary } from './types';
import { normalizeInstructorName } from './instructorDirectory';

export { normalizeInstructorName } from './instructorDirectory';

// Students, interactions, accounts and sessions all live in PostgreSQL (see db/ and app/api/).

// Exact match after normalization. Substring matching was removed because "Gaurav" matched both Gaurav cohorts.
export function instructorNamesMatch(left: string, right: string): boolean {
  return normalizeInstructorName(left) === normalizeInstructorName(right);
}

// Email comparison first; exact-name fallback only for students without a matched instructor.
export function isStudentAssignedTo(student: Student, user: { name: string; email?: string } | null): boolean {
  if (!user) return false;
  const studentEmail = (student.instructorEmail || '').toLowerCase();
  const userEmail = (user.email || '').toLowerCase();
  if (studentEmail && userEmail) return studentEmail === userEmail;
  return instructorNamesMatch(student.instructor, user.name);
}

export function normalizeTopicValue(value: string | undefined | null): string {
  const raw = (value || '').trim();
  if (!raw) return '';

  const normalized = raw.replace(/\s+/g, ' ');
  if (/^1\.0\s*Introduction$/i.test(normalized)) return 'Introduction';
  return normalized;
}

export function normalizeStepValue(value: string | undefined | null): string {
  const raw = (value || '').trim();
  if (!raw) return '';

  const normalized = raw.replace(/\s+/g, ' ').replace(/tweeked/gi, 'tweaked');
  if (/^1\.0\s*Introduction$/i.test(normalized)) return 'Introduction';
  return normalized;
}

// Level 2 covers basic recursion and Level 5 covers advanced recursion; legacy data stored plain "Recursion".
export function normalizeRecursionTopic(topic: string, level: string): string {
  if (topic.toLowerCase() !== 'recursion') return topic;
  return level === 'Level 5' ? 'Recursion - Advanced' : 'Recursion - Basics';
}

export { getDefaultStepForLevel, getDefaultTopicForLevel } from './multiLevelCurriculum';

// Student status text written after an interaction is logged (shared with the API). No round numbers:
// the UI filters on the words "Revisit" and "Cleared".
export const PENDING_STATUS = 'Pending Evaluation';
export function statusAfterInteraction(log: Pick<InteractionLog, 'statusPostInteraction'>): string {
  if (log.statusPostInteraction === 'Need to Revisit') return 'Needs Revisit';
  if (log.statusPostInteraction === 'Cleared') return 'Cleared';
  return 'In Progress';
}

export function getInstructorSummaries(students: Student[]): InstructorSummary[] {
  const map = new Map<string, { id?: string; name: string; email: string; assigned: number; completed: number; revisit: number; cleared: number; halls: Set<string>; levels: Set<string>; }>();
  // Grouped by instructor email so the two "Gaurav" instructors stay separate; keyed by full name for display.
  for (const s of students) {
    const inst = s.instructorFullName || s.instructor || 'Unassigned';
    const key = s.instructorEmail || `unmatched:${inst}`;
    if (!map.has(key)) {
      map.set(key, { id: s.instructorId, name: inst, email: s.instructorEmail ?? '', assigned: 0, completed: 0, revisit: 0, cleared: 0, halls: new Set(), levels: new Set() });
    }
    const entry = map.get(key)!;
    entry.assigned++;
    if (s.hall) entry.halls.add(s.hall);
    if (s.level) entry.levels.add(s.level);
    if (s.interactionCount > 0) {
      entry.completed++;
      if (s.status.includes('Revisit')) entry.revisit++;
      else if (s.status.includes('Cleared')) entry.cleared++;
    }
  }
  return Array.from(map.values()).map((d) => ({ id: d.id, name: d.name, email: d.email, assignedCount: d.assigned, completedCount: d.completed, revisitCount: d.revisit, clearedCount: d.cleared, primaryHall: Array.from(d.halls).join(', ') || 'N/A', levels: Array.from(d.levels) })).sort((a, b) => a.name.localeCompare(b.name));
}

export function exportInteractionsToCSV(interactions: InteractionLog[]): void {
  const headers = ["Instructor's Name","Instructor Email","Topics","Status Post Interaction","Rating","Questions Asked","Remarks","Performed Well","Improvement Areas","Tweaked Questions","Action Items","Meet Recording","Granola Transcript"];
  const esc = (v: string | number | undefined | null) => { if (v == null) return '""'; return `"${String(v).replace(/"/g, '""')}"`; };
  const rows = [headers.map(esc).join(',')];
  for (const log of interactions) {
    rows.push([log.instructorName, log.instructorEmail ?? '', log.topics, log.statusPostInteraction, log.rating, log.questionsAsked, log.remarks, log.performedWell, log.improvementAreas, log.tweakedQuestions, log.actionItems, log.meetRecording, log.granolaTranscript].map(esc).join(','));
  }
  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `dsa_interactions_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
