import { InstructorMatchStatus } from './types';

// Pure matching rules, no data. The deployed app passes the instructor list loaded from the DB
// `instructors` table; only the offline seed script reads lib/data/instructors.json.

export interface DirectoryInstructor {
  id: string;
  firstName: string;
  name: string;      // full name, shown in the Instructor List
  email: string;     // company email, unique
  aliases: string[]; // spelling variants and batch labels used in the Student List, e.g. "Gaurav - 25"
}

export interface InstructorMatch {
  status: InstructorMatchStatus;
  instructor?: DirectoryInstructor;
  candidates: DirectoryInstructor[]; // filled when status is 'ambiguous'
}

export function normalizeInstructorName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(admin|sir|mr|mrs|ms)\b/g, '')
    .trim();
}

function firstToken(value: string): string {
  return normalizeInstructorName(value).split(/[\s\-()]+/).filter(Boolean)[0] ?? '';
}

// Student List value -> directory instructor.
// Order: email (unique) > exact full name or alias > first name. A first name shared by several
// instructors is reported as 'ambiguous' and never guessed.
export function matchInstructor(
  directory: DirectoryInstructor[],
  rawName: string | undefined | null,
  email?: string | null
): InstructorMatch {
  const emailLower = (email || '').trim().toLowerCase();
  if (emailLower) {
    const byEmail = directory.find((entry) => entry.email === emailLower);
    if (byEmail) return { status: 'matched', instructor: byEmail, candidates: [] };
  }

  const raw = (rawName || '').trim();
  if (!raw) return { status: 'unmatched', candidates: [] };

  if (raw.includes('@')) return matchInstructor(directory, undefined, raw);

  const normalized = normalizeInstructorName(raw);
  const exact = directory.find((entry) =>
    [entry.name, ...entry.aliases].some((candidate) => normalizeInstructorName(candidate) === normalized)
  );
  if (exact) return { status: 'matched', instructor: exact, candidates: [] };

  const token = firstToken(raw);
  const byFirstName = directory.filter((entry) =>
    [entry.firstName, ...entry.aliases].some((candidate) => firstToken(candidate) === token)
  );
  const unique = Array.from(new Map(byFirstName.map((entry) => [entry.id, entry])).values());

  if (unique.length === 1) return { status: 'matched', instructor: unique[0], candidates: [] };
  if (unique.length > 1) return { status: 'ambiguous', candidates: unique };
  return { status: 'unmatched', candidates: [] };
}
