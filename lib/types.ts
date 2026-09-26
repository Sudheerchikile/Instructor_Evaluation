export type DSALevel = 0 | 1 | 2 | 3 | 4;
export type InstructorRole = 'admin' | 'instructor';

export interface Student {
  id: string;
  name: string;
  degree: string;
  section: string;
  level: string;
  currentStep?: string;
  currentTopic?: string;
  hall: string;
  instructor: string;
  interactionCount: number;
  status: string;
  lastInteractionDate?: string | null;
  instructorEmail?: string;
}

export interface InteractionLog {
  id: string;
  studentId: string;
  studentName: string;
  instructorName: string;
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
  date: string;
  createdAt: string;
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

export interface InstructorUser {
  id: string;
  name: string;
  email: string;
  role: InstructorRole;
  hall?: string;
  passwordHash: string;
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
  questionsAsked: string[];
  performedWell: string[];
  improvementAreas: string[];
  remarks: string[];
  suggestedStatus: 'Need to Revisit' | 'Cleared';
  suggestedRating: number;
  actionItems: string[];
}
