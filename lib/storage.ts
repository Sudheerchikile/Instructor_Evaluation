import { Student, InteractionLog, InstructorSummary, InstructorUser } from './types';
import rawStudents from './data/students.json';
import rawInteractions from './data/initialInteractions.json';

const STORAGE_KEY_STUDENTS     = 'kkh_dsa_students_v2';
const STORAGE_KEY_INTERACTIONS = 'kkh_dsa_interactions_v2';
const STORAGE_KEY_CURRENT_USER = 'kkh_dsa_current_user_v2';
const STORAGE_KEY_INSTRUCTORS  = 'kkh_dsa_instructors_v2';
export const AUTH_COOKIE_NAME  = 'kkh_auth_session';

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = (hash * 33) ^ str.charCodeAt(i);
  return (hash >>> 0).toString(36);
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

export function instructorNamesMatch(left: string, right: string): boolean {
  const first = normalizeInstructorName(left);
  const second = normalizeInstructorName(right);
  if (!first || !second) return first === second;
  if (first === second) return true;
  return first.includes(second) || second.includes(first);
}

export function canonicalInstructorName(value: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';

  const normalized = normalizeInstructorName(raw);
  if (['ashutosh', 'ashotosh', 'ashitosh'].includes(normalized)) {
    return 'Ashutosh Rana';
  }

  if (typeof window !== 'undefined') {
    const registered = getRegisteredInstructors();
    const match = registered.find((instructor) => instructorNamesMatch(instructor.name, raw));
    if (match) return match.name;
  }

  return raw;
}

const PRESET_INSTRUCTORS: InstructorUser[] = [
  { id: 'admin',  name: 'Admin',          email: 'admin@kkh.edu',            role: 'admin',      passwordHash: simpleHash('admin') },
  { id: 'inst-1', name: 'Ashutosh Rana',  email: 'ashutosh.rana@kkh.edu',    role: 'instructor', hall: 'Hall A', passwordHash: simpleHash('evaluator123') },
  { id: 'inst-2', name: 'Priya Sharma',   email: 'priya.sharma@kkh.edu',     role: 'instructor', hall: 'Hall B', passwordHash: simpleHash('evaluator123') },
  { id: 'inst-3', name: 'Rahul Verma',    email: 'rahul.verma@kkh.edu',      role: 'instructor', hall: 'Hall C', passwordHash: simpleHash('evaluator123') },
  { id: 'inst-4', name: 'Sneha Patel',    email: 'sneha.patel@kkh.edu',      role: 'instructor', hall: 'Hall D', passwordHash: simpleHash('evaluator123') },
  { id: 'inst-5', name: 'Vikram Singh',   email: 'vikram.singh@kkh.edu',     role: 'instructor', hall: 'Hall E', passwordHash: simpleHash('evaluator123') },
];

export function getRegisteredInstructors(): InstructorUser[] {
  if (typeof window === 'undefined') return PRESET_INSTRUCTORS;
  try {
    const item = localStorage.getItem(STORAGE_KEY_INSTRUCTORS);
    if (!item) { localStorage.setItem(STORAGE_KEY_INSTRUCTORS, JSON.stringify(PRESET_INSTRUCTORS)); return PRESET_INSTRUCTORS; }
    return JSON.parse(item) as InstructorUser[];
  } catch { return PRESET_INSTRUCTORS; }
}

function saveRegisteredInstructors(list: InstructorUser[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_INSTRUCTORS, JSON.stringify(list));
}

export function registerInstructor(name: string, email: string, password: string, hall?: string): { success: boolean; error?: string; user?: InstructorUser } {
  const instructors = getRegisteredInstructors();
  const emailLower = email.toLowerCase().trim();
  if (instructors.find(i => i.email.toLowerCase() === emailLower)) return { success: false, error: 'An account with this email already exists.' };
  const newUser: InstructorUser = { id: `inst-${Date.now()}`, name: name.trim(), email: emailLower, role: 'instructor', hall: hall?.trim(), passwordHash: simpleHash(password) };
  saveRegisteredInstructors([...instructors, newUser]);
  return { success: true, user: newUser };
}

export function authenticateWithEmail(email: string, password: string): { success: boolean; error?: string; user?: InstructorUser } {
  const instructors = getRegisteredInstructors();
  const user = instructors.find(i => i.email.toLowerCase() === email.toLowerCase().trim());
  if (!user) return { success: false, error: 'No account found with this email address.' };
  if (user.passwordHash !== simpleHash(password)) return { success: false, error: 'Incorrect password.' };
  return { success: true, user };
}

export function getStoredCurrentUser(): InstructorUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (!item) return null;
    return JSON.parse(item) as InstructorUser;
  } catch { return null; }
}

export function saveStoredCurrentUser(user: InstructorUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
  document.cookie = `${AUTH_COOKIE_NAME}=${user.id}; path=/; SameSite=Lax`;
}

export function clearStoredInstructorSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function getDefaultStepForLevel(level: string): string {
  const options: Record<string, string[]> = {
    'Level 0': ['1.0 Introduction', '1.1 - Data Types', '1.2 If else', '1.3 Loops', '2. Traversal', '3. Time & Space Complexity analysis', '4. Pattern Questions'],
    'Level 1': ['0', '1.1', '1.2', '1.3', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
    'Level 2': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
    'Level 3': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
    'Level 4': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
    'Level 5': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
    'Level 6': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
    'Level 7': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2']
  };

  const nextLevel = typeof level === 'string' && /^Level\s+\d+$/.test(level) ? level : 'Level 0';
  return options[nextLevel]?.[0] || '1.0 Introduction';
}

export function getDefaultTopicForLevel(level: string): string {
  const options: Record<string, string[]> = {
    'Level 0': ['1.0 Introduction', '1.1 - Data Types', '1.2 If else', '1.3 Loops', '2. Traversal', '3. Time & Space Complexity analysis', '4. Pattern Questions'],
    'Level 1': ['Maths', 'STL - Introduction', 'STL - Standard Template Library', 'Array - Basics', 'Arrays', 'String'],
    'Level 2': ['Recursion', 'Sorting', 'Binary Search'],
    'Level 3': ['Two pointers / Sliding window', 'Greedy Algorithms'],
    'Level 4': ['Bit Manipulation', 'Stack & Queues', 'Stack - Monotonic Stack'],
    'Level 5': ['Hashing', 'Heap', 'Graphs', 'Dynamic programming'],
    'Level 6': ['Advanced trees', 'Backtracking', 'Trie', 'Segment tree'],
    'Level 7': ['Advanced DSA / Mock Interview Track']
  };

  const nextLevel = typeof level === 'string' && /^Level\s+\d+$/.test(level) ? level : 'Level 0';
  return options[nextLevel]?.[0] || '1.0 Introduction';
}

function normalizeStudentLevel(student: Student): Student {
  const level = 'Level 0';

  return {
    ...student,
    instructor: canonicalInstructorName(student.instructor),
    level,
    currentStep: student.currentStep || getDefaultStepForLevel(level),
    currentTopic: student.currentTopic || getDefaultTopicForLevel(level),
  };
}

export function getStoredStudents(): Student[] {
  const source = (typeof window === 'undefined') ? rawStudents as Student[] : (() => {
    try {
      const item = localStorage.getItem(STORAGE_KEY_STUDENTS);
      if (!item) {
        const seeded = (rawStudents as Student[]).map(normalizeStudentLevel);
        localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(seeded));
        return seeded;
      }
      return JSON.parse(item) as Student[];
    } catch {
      return rawStudents as Student[];
    }
  })();

  const normalized = (source || []).map(normalizeStudentLevel);

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(normalized));
  }

  return normalized;
}

export function saveStudents(students: Student[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students.map(normalizeStudentLevel))); } catch (err) { console.error(err); }
}

export function getStoredInteractions(): InteractionLog[] {
  if (typeof window === 'undefined') return rawInteractions as InteractionLog[];
  try {
    const item = localStorage.getItem(STORAGE_KEY_INTERACTIONS);
    if (!item) { localStorage.setItem(STORAGE_KEY_INTERACTIONS, JSON.stringify(rawInteractions)); return rawInteractions as InteractionLog[]; }
    return JSON.parse(item);
  } catch { return rawInteractions as InteractionLog[]; }
}

export function saveInteractions(interactions: InteractionLog[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY_INTERACTIONS, JSON.stringify(interactions)); } catch (err) { console.error(err); }
}

export function getStoredCurrentInstructor(): string {
  return getStoredCurrentUser()?.name ?? '';
}

export function saveCurrentInstructor(_name: string): void { void _name; }

export function addInteractionLog(newLog: InteractionLog): { students: Student[]; interactions: InteractionLog[] } {
  const currentLogs = getStoredInteractions();
  const updatedLogs = [newLog, ...currentLogs];
  saveInteractions(updatedLogs);
  const students = getStoredStudents();
  const idx = students.findIndex(s => s.id === newLog.studentId);
  if (idx !== -1) {
    const s = { ...students[idx] };
    s.interactionCount = (s.interactionCount || 0) + 1;
    s.lastInteractionDate = newLog.date;

    if (newLog.statusPostInteraction === 'Need to Revisit') {
      s.status = newLog.interactionRound === 1
        ? 'Round 1 Revisit — needs retry on Level 0 basics'
        : 'Round 2 Revisit — needs retry before Level 1 promotion';
    } else if (newLog.statusPostInteraction === 'Cleared') {
      s.status = newLog.interactionRound >= 2
        ? 'Level 0 Cleared (Rounds 1 & 2 complete) — eligible for Level 1'
        : 'Round 1 Cleared — eligible for Round 2';
    } else {
      s.status = `Interaction ${newLog.interactionRound} In Progress`;
    }

    students[idx] = s;
    saveStudents(students);
  }
  return { students, interactions: updatedLogs };
}

export function getInstructorSummaries(students: Student[]): InstructorSummary[] {
  const registered = getRegisteredInstructors();
  const map = new Map<string, { email: string; assigned: number; completed: number; revisit: number; cleared: number; halls: Set<string>; levels: Set<string>; }>();
  for (const s of students) {
    const inst = canonicalInstructorName(s.instructor || 'Unassigned');
    if (!map.has(inst)) {
      const email = registered.find(i => instructorNamesMatch(i.name, inst))?.email ?? '';
      map.set(inst, { email, assigned: 0, completed: 0, revisit: 0, cleared: 0, halls: new Set(), levels: new Set() });
    }
    const entry = map.get(inst)!;
    entry.assigned++;
    if (s.hall) entry.halls.add(s.hall);
    if (s.level) entry.levels.add(s.level);
    if (s.interactionCount > 0) {
      entry.completed++;
      if (s.status.includes('Revisit')) entry.revisit++;
      else if (s.status.includes('Cleared')) entry.cleared++;
    }
  }
  return Array.from(map.entries()).map(([name, d]) => ({ name, email: d.email, assignedCount: d.assigned, completedCount: d.completed, revisitCount: d.revisit, clearedCount: d.cleared, primaryHall: Array.from(d.halls).join(', ') || 'N/A', levels: Array.from(d.levels) })).sort((a, b) => a.name.localeCompare(b.name));
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
