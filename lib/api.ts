import { CreateInstructorResult, InstructorListEntry, InstructorOption, InstructorUser, InteractionLog, LevelConversion, NewInstructorInput, Student } from './types';

// Browser-side calls to the app/api routes (PostgreSQL-backed).

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError((body as { error?: string }).error ?? `Request failed (${response.status})`, response.status);
  return body as T;
}

export const signIn = (email: string, password: string) =>
  request<InstructorUser>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const signOut = () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' });

export const fetchCurrentUser = () => request<InstructorUser>('/api/auth/me');

export const fetchInstructors = () => request<InstructorListEntry[]>('/api/instructors');

export const fetchInstructorOptions = () => request<InstructorOption[]>('/api/instructors/options');

export const createInstructor = (input: NewInstructorInput) =>
  request<CreateInstructorResult>('/api/instructors', { method: 'POST', body: JSON.stringify(input) });

export const assignStudentsToInstructor = (instructorId: string, studentIds: string[]) =>
  request<CreateInstructorResult>(`/api/instructors/${encodeURIComponent(instructorId)}/students`, { method: 'POST', body: JSON.stringify({ studentIds }) });

export const fetchStudents =() => request<Student[]>('/api/students');

export const fetchInteractions = () => request<InteractionLog[]>('/api/interactions');

export const fetchLevelConversions = () => request<LevelConversion[]>('/api/analytics/level-conversions');

export const updateStudentProgress = (id: string, patch: { level?: string; currentTopic?: string; currentStep?: string }) =>
  request<Student>(`/api/students/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const updateInteraction = (id: string, patch: Partial<InteractionLog>) =>
  request<{ student: Student; interaction: InteractionLog }>(`/api/interactions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteInteraction = (id: string, reason: string) =>
  request<{ student: Student }>(`/api/interactions/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ reason }) });

export const createInteraction = (log: InteractionLog) =>
  request<{ student: Student; interaction: InteractionLog }>('/api/interactions', { method: 'POST', body: JSON.stringify(log) });
