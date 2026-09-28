export type DSALevel = 0 | 1 | 2 | 3 | 4;
export type InstructorRole = 'admin' | 'instructor';
export type InstructorMatchStatus = 'matched' | 'ambiguous' | 'unmatched';

export interface Student {
  id: string;
  name: string;
  degree: string;
  section: string;
  level: string;
  currentStep?: string;
  currentTopic?: string;
  hall: string;
  instructor: string;            // Student List display: instructor FIRST NAME only (raw value when not matched)
  interactionCount: number;
  levelInteractionCount?: number; // interactions logged at the student's current level
  status: string;                 // standing at the current level: Pending Evaluation | In Progress | Needs Revisit | Cleared
  lastInteractionDate?: string | null;
  instructorEmail?: string;      // matched instructor's company email (the join key)
  instructorId?: string;         // matched instructor's directory id, e.g. INS010
  instructorFullName?: string;   // matched instructor's full name, for the Instructor List and snapshots
  instructorMatch?: InstructorMatchStatus;
}

export interface InteractionLog {
  id: string;
  studentId: string;
  studentName: string;
  instructorName: string;
  assignedInstructorName?: string;
  instructorEmail?: string;
  topics: string;
  statusPostInteraction: 'Need to Revisit' | 'Cleared' | 'In Progress' | string;
  rating: number;
  questionsAsked: string;
  remarks: string;
  performedWell: string;
  improvementAreas: string;
  tweakedQuestions: string;
  actionItems: string;
  meetRecording: string;
  granolaTranscript: string;
  interactionRound: number;
  level?: string;        // student's level when the interaction was logged
  currentStep?: string;  // student's step when the interaction was logged
  date: string;
  createdAt: string;
}

// API shape: Student List entry, enriched with the matched instructor and full feedback history.
export interface StudentInstructorRef {
  name: string;          // first name only (Student List display)
  instructorId: string | null;
  fullName: string | null;
  email: string | null;
  match: InstructorMatchStatus;
}

export type StudentListEntry = Omit<Student, 'instructor' | 'instructorEmail' | 'instructorId' | 'instructorFullName' | 'instructorMatch'> & {
  instructor: StudentInstructorRef;
  feedback: InteractionLog[]; // latest first; [] when the student has no interactions
};

// API shape: Instructor List entry, using the instructor's full name.
export interface InstructorListEntry {
  id: string;
  firstName: string;
  name: string;          // full name
  email: string;
  students: Array<Pick<Student, 'id' | 'name' | 'level' | 'currentTopic' | 'currentStep' | 'lastInteractionDate'>>;
}

export interface QuestionItem {
  id: string;
  title: string;
  description?: string;
  url?: string;
  answer?: string;
}

export interface CurriculumStep {
  step: string;
  id: string;
  title: string;
  suggestedTimeMins: number;
  questionRule: string;
  hintRule: string;
  mandatory: boolean;
  passCriteria?: string;
  expectation: string;
  questions: QuestionItem[];
}

// Signed-in user as returned by /api/auth/me. Password hashes never leave the server.
export interface InstructorUser {
  id: string;
  name: string;
  email: string;
  role: InstructorRole;
  instructorId: string | null; // directory id for instructors; null for admins
}

export interface InstructorSummary {
  name: string;
  email?: string;
  assignedCount: number;
  completedCount: number;
  revisitCount: number;
  clearedCount: number;
  primaryHall: string;
  levels: string[];
}

export interface ParsedTranscriptResult {
  title?: string;
  date?: string;
  instructor?: string;
  instructorName?: string;
  topics?: string;
  status?: 'Need to Revisit' | 'Cleared' | 'In Progress';
  questionsAsked: string[];
  performedWell: string[];
  improvementAreas: string[];
  remarks: string[];
  suggestedStatus: 'Need to Revisit' | 'Cleared';
  suggestedRating: number;
  actionItems: string[];
  tweakedQuestions?: string[];
  meetRecording?: string;
  granolaTranscript?: string;
}
