// Unsaved Log / Edit Interaction form contents, kept in this browser's localStorage so a reload, a dropped
// connection or an accidentally closed form doesn't lose what the instructor typed. One draft per
// signed-in user and per student (new log) or per interaction (edit). Cleared once the server confirms the save.

export interface InteractionDraftFields {
  interactionDate: string;
  takenById: string | null;
  topics: string[];
  statusPostInteraction: 'Need to Revisit' | 'Cleared' | 'In Progress';
  rating: number;
  questionsAsked: string;
  remarks: string;
  performedWell: string;
  improvementAreas: string;
  tweakedQuestions: string;
  actionItems: string;
  meetRecording: string;
}

interface StoredDraft {
  savedAt: string; // ISO time of the last change
  fields: InteractionDraftFields;
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // older drafts are dropped

export function interactionDraftKey(userId: string, target: { studentId: string; editingId?: string | null }): string {
  return `kkh:interaction-draft:${userId}:${target.editingId ? `edit:${target.editingId}` : `new:${target.studentId}`}`;
}

// Storage can be unavailable (private mode, blocked site data); drafts are then simply not kept.
export function loadInteractionDraft(key: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredDraft;
    if (!draft?.fields || Date.now() - new Date(draft.savedAt).getTime() > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveInteractionDraft(key: string, fields: InteractionDraftFields): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), fields } satisfies StoredDraft));
  } catch { /* storage full or unavailable */ }
}

export function clearInteractionDraft(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* unavailable */ }
}
