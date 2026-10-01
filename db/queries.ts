import type { PoolClient } from 'pg';
import { getPool } from './client';
import { CreateInstructorResult, InstructorListEntry, InstructorMatchStatus, InstructorOption, InstructorUser, InteractionLog, NewInstructorInput, Student, StudentListEntry } from '../lib/types';
import { DirectoryInstructor, matchInstructor } from '../lib/instructorDirectory';
import { LEVELS, coerceStep, getDefaultTopicForLevel, getStepOptionsForTopic, getTopicOptions } from '../lib/multiLevelCurriculum';
import { normalizeInstructorName, statusAfterInteraction } from '../lib/storage';
import { hashPassword } from './auth';

// Data access for the API routes. Output field names match lib/types.ts.

export class ValidationError extends Error {}
export class ForbiddenError extends Error {}

// Only the instructor a student is assigned to may change that student or log interactions for them.
// Admins have read-only access to students.
function assertCanEdit(student: Student, actor: InstructorUser) {
  if (actor.role !== 'instructor' || !actor.instructorId || student.instructorId !== actor.instructorId) {
    throw new ForbiddenError(`Only ${student.instructorFullName ?? 'the assigned instructor'} can update ${student.name}.`);
  }
}

const levelNumber = (label: string) => Number(label.replace('Level ', ''));

const INTERACTION_JSON = `
  json_build_object(
    'id', it.id,
    'studentId', it.student_id,
    'studentName', it.student_name,
    'instructorName', it.instructor_name,
    'instructorEmail', it.instructor_email,
    'takenByInstructorId', it.taken_by_instructor_id,
    'assignedInstructorName', it.assigned_instructor_name,
    'level', CASE WHEN it.level IS NULL THEN NULL ELSE 'Level ' || it.level END,
    'currentStep', it.current_step,
    'topics', it.topics,
    'statusPostInteraction', it.status_post_interaction,
    'rating', it.rating::float,
    'questionsAsked', it.questions_asked,
    'remarks', it.remarks,
    'performedWell', it.performed_well,
    'improvementAreas', it.improvement_areas,
    'tweakedQuestions', it.tweaked_questions,
    'actionItems', it.action_items,
    'meetRecording', it.meet_recording,
    'granolaTranscript', it.granola_transcript,
    'interactionRound', it.interaction_round,
    'date', to_char(it.date, 'YYYY-MM-DD'),
    'createdAt', it.created_at,
    'createdBy', it.created_by,
    'updatedAt', it.updated_at
  )`;

interface StudentOverviewRow {
  id: string;
  name: string;
  degree: string;
  section: string;
  hall: string;
  instructor_raw: string;
  instructor_id: string | null;
  instructor_match: InstructorMatchStatus;
  instructor_first_name: string | null;
  instructor_full_name: string | null;
  instructor_email: string | null;
  level: number;
  current_topic: string;
  current_step: string;
  status: string;
  interaction_count: number;
  last_interaction_date: string | null;
  level_status: string;
  level_interaction_count: number;
}

// Flat Student shape used by the existing UI components.
function toStudent(row: StudentOverviewRow): Student {
  return {
    id: row.id,
    name: row.name,
    degree: row.degree,
    section: row.section,
    hall: row.hall,
    level: `Level ${row.level}`,
    currentTopic: row.current_topic,
    currentStep: row.current_step,
    status: row.level_status, // standing at the current level (see student_overview)
    interactionCount: row.interaction_count,
    levelInteractionCount: row.level_interaction_count,
    lastInteractionDate: row.last_interaction_date,
    instructor: row.instructor_first_name ?? row.instructor_raw,
    instructorEmail: row.instructor_email ?? undefined,
    instructorId: row.instructor_id ?? undefined,
    instructorFullName: row.instructor_full_name ?? undefined,
    instructorMatch: row.instructor_match,
  };
}

export async function getStudents(): Promise<Student[]> {
  const { rows } = await getPool().query<StudentOverviewRow>('SELECT * FROM student_overview ORDER BY name');
  return rows.map(toStudent);
}

async function getStudent(id: string, client?: PoolClient): Promise<Student | null> {
  const { rows } = await (client ?? getPool()).query<StudentOverviewRow>('SELECT * FROM student_overview WHERE id = $1', [id]);
  return rows[0] ? toStudent(rows[0]) : null;
}

// Level / topic / step change from the "My Students" page. Invalid combinations are rejected, and a
// level change without an explicit topic resets topic and step to that level's defaults.
export async function updateStudentProgress(
  id: string,
  patch: { level?: string; currentTopic?: string; currentStep?: string },
  actor: InstructorUser
): Promise<Student | null> {
  const current = await getStudent(id);
  if (!current) return null;
  assertCanEdit(current, actor);

  const level = patch.level ?? current.level;
  if (!LEVELS.includes(level)) throw new ValidationError(`Unknown level "${level}".`);
  const levelChanged = level !== current.level;

  const topic = patch.currentTopic ?? (levelChanged ? getDefaultTopicForLevel(level) : current.currentTopic ?? getDefaultTopicForLevel(level));
  if (!getTopicOptions(level).includes(topic)) throw new ValidationError(`Topic "${topic}" is not part of ${level}.`);
  const topicChanged = topic !== current.currentTopic;

  const step = patch.currentStep ?? (levelChanged || topicChanged ? coerceStep(level, topic, undefined) : coerceStep(level, topic, current.currentStep));
  if (!getStepOptionsForTopic(level, topic).includes(step)) throw new ValidationError(`Step "${step}" is not valid for ${topic}.`);

  await getPool().query(
    'UPDATE students SET level = $2, current_topic = $3, current_step = $4, updated_at = now() WHERE id = $1',
    [id, levelNumber(level), topic, step]
  );
  return getStudent(id);
}

export async function getInteractions(): Promise<InteractionLog[]> {
  const { rows } = await getPool().query<{ log: InteractionLog }>(
    `SELECT ${INTERACTION_JSON} AS log FROM interactions it ORDER BY it.date DESC, it.created_at DESC`
  );
  return rows.map((row) => row.log);
}

// Instructor directory as stored in the DB (the source of truth at run time).
async function loadDirectory(client: PoolClient): Promise<DirectoryInstructor[]> {
  const { rows } = await client.query<{ id: string; first_name: string; full_name: string; email: string; aliases: string[] }>(
    'SELECT id, first_name, full_name, email, aliases FROM instructors'
  );
  return rows.map((r) => ({ id: r.id, firstName: r.first_name, name: r.full_name, email: r.email, aliases: r.aliases }));
}

// Inserts one interaction row.
export async function insertInteraction(
  client: PoolClient,
  log: InteractionLog,
  student: { instructorId?: string | null; level?: string; currentStep?: string },
  options: { skipExisting?: boolean; createdBy?: string } = {}
): Promise<boolean> {
  const directory = await loadDirectory(client);
  // Picked from the instructor dropdown (id); name/email matching is the fallback for older clients.
  const takenBy = directory.find((i) => i.id === log.takenByInstructorId)
    ?? matchInstructor(directory, log.instructorName, log.instructorEmail).instructor;
  const snapshotLevel = log.level ?? student.level;
  const result = await client.query(
    `INSERT INTO interactions (id, student_id, student_name, instructor_name, instructor_email, taken_by_instructor_id,
       assigned_instructor_id, assigned_instructor_name, level, current_step, topics, status_post_interaction, rating,
       questions_asked, remarks, performed_well, improvement_areas, tweaked_questions, action_items, meet_recording,
       granola_transcript, interaction_round, date, created_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
     ${options.skipExisting ? 'ON CONFLICT (id) DO NOTHING' : ''}`,
    [
      log.id, log.studentId, log.studentName, log.instructorName || '', log.instructorEmail ?? null, takenBy?.id ?? null,
      student.instructorId ?? null, log.assignedInstructorName ?? null,
      snapshotLevel && LEVELS.includes(snapshotLevel) ? levelNumber(snapshotLevel) : null,
      log.currentStep ?? student.currentStep ?? null,
      log.topics || '', log.statusPostInteraction, log.rating ?? 0, log.questionsAsked || '', log.remarks || '',
      log.performedWell || '', log.improvementAreas || '', log.tweakedQuestions || '', log.actionItems || '',
      log.meetRecording || '', log.granolaTranscript || '', log.interactionRound || 1, log.date, log.createdAt,
      options.createdBy ?? null,
    ]
  );
  return (result.rowCount ?? 0) > 0;
}

// Saves an interaction and updates the student's status in one transaction.
const STATUSES = ['Need to Revisit', 'Cleared', 'In Progress'];

// Field checks shared by creating and editing an interaction.
function validateInteractionFields(log: Pick<InteractionLog, 'date' | 'rating' | 'statusPostInteraction'>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log.date || '')) throw new ValidationError('Interaction date must be YYYY-MM-DD.');
  // No future-dated interactions. The server runs in UTC; +14h covers every user timezone's "today".
  if (log.date > new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 10)) {
    throw new ValidationError('Interaction date cannot be in the future.');
  }
  if (!(Number(log.rating) >= 0 && Number(log.rating) <= 5)) throw new ValidationError('Rating must be between 0 and 5.');
  if (!STATUSES.includes(log.statusPostInteraction)) throw new ValidationError('Choose a valid status.');
}

async function getInteraction(id: string): Promise<InteractionLog | null> {
  const { rows } = await getPool().query<{ log: InteractionLog }>(`SELECT ${INTERACTION_JSON} AS log FROM interactions it WHERE it.id = $1`, [id]);
  return rows[0]?.log ?? null;
}

// Editing or deleting an interaction: the student's assigned instructor or whoever logged it. Admins: 403.
function assertCanChangeInteraction(log: InteractionLog, student: Student, actor: InstructorUser, action: 'edit' | 'delete') {
  const isAssigned = actor.role === 'instructor' && !!actor.instructorId && student.instructorId === actor.instructorId;
  const isAuthor = actor.role === 'instructor' && log.createdBy === actor.id;
  if (!isAssigned && !isAuthor) {
    throw new ForbiddenError(`Only the assigned instructor or the person who logged this interaction can ${action} it.`);
  }
}

// Delete an interaction (duplicate or wrong details). The row moves to deleted_interactions together with
// the reason, who deleted it and when; the student's status and counts follow because they are derived.
export async function deleteInteraction(id: string, reason: string, actor: InstructorUser): Promise<{ student: Student }> {
  const why = (reason ?? '').trim();
  if (why.length < 5) throw new ValidationError('Give a reason for deleting this interaction (at least 5 characters).');
  if (why.length > 1000) throw new ValidationError('The reason is too long (max 1000 characters).');

  const current = await getInteraction(id);
  if (!current) throw new ValidationError('Interaction not found. It may already have been deleted.');
  const student = await getStudent(current.studentId);
  if (!student) throw new ValidationError('Student not found.');
  assertCanChangeInteraction(current, student, actor, 'delete');

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO deleted_interactions (id, student_id, data, delete_reason, deleted_by)
       SELECT it.id, it.student_id, to_jsonb(it), $2, $3 FROM interactions it WHERE it.id = $1`,
      [id, why, actor.id]
    );
    const { rowCount } = await client.query('DELETE FROM interactions WHERE id = $1', [id]);
    if (rowCount !== 1) throw new ValidationError('Interaction not found. It may already have been deleted.');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { student: (await getStudent(current.studentId))! };
}

// Edit a logged interaction. Allowed for the student's assigned instructor or whoever logged it.
// Student, level/step snapshot and creation time are fixed; the rest can be corrected.
export async function updateInteraction(
  id: string,
  patch: Partial<InteractionLog>,
  actor: InstructorUser
): Promise<{ student: Student; interaction: InteractionLog }> {
  const current = await getInteraction(id);
  if (!current) throw new ValidationError('Interaction not found.');
  const student = await getStudent(current.studentId);
  if (!student) throw new ValidationError('Student not found.');
  assertCanChangeInteraction(current, student, actor, 'edit');

  const next = { ...current, ...patch };
  validateInteractionFields(next);

  const client = await getPool().connect();
  try {
    const directory = await loadDirectory(client);
    const takenBy = directory.find((i) => i.id === next.takenByInstructorId);
    if (!takenBy) throw new ValidationError('Select who took this interaction.');

    await client.query(
      `UPDATE interactions SET date = $2, instructor_name = $3, taken_by_instructor_id = $4, topics = $5,
         status_post_interaction = $6, rating = $7, questions_asked = $8, remarks = $9, performed_well = $10,
         improvement_areas = $11, tweaked_questions = $12, action_items = $13, meet_recording = $14,
         updated_at = now(), updated_by = $15
       WHERE id = $1`,
      [
        id, next.date, takenBy.name, takenBy.id, next.topics || '', next.statusPostInteraction, Number(next.rating),
        next.questionsAsked || '', next.remarks || '', next.performedWell || '', next.improvementAreas || '',
        next.tweakedQuestions || '', next.actionItems || '', next.meetRecording || '', actor.id,
      ]
    );
  } finally {
    client.release();
  }
  // The student's status is derived from their interactions, so re-read it too.
  return { student: (await getStudent(current.studentId))!, interaction: (await getInteraction(id))! };
}

export async function addInteraction(log: InteractionLog, actor: InstructorUser): Promise<{ student: Student; interaction: InteractionLog }> {
  validateInteractionFields(log);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const student = await getStudent(log.studentId, client);
    if (!student) throw new ValidationError(`Unknown student "${log.studentId}".`);
    assertCanEdit(student, actor);

    await insertInteraction(client, log, student, { createdBy: actor.id });
    await client.query('UPDATE students SET status = $2, updated_at = now() WHERE id = $1', [log.studentId, statusAfterInteraction(log)]);
    await client.query('COMMIT');

    const { rows } = await getPool().query<{ log: InteractionLog }>(`SELECT ${INTERACTION_JSON} AS log FROM interactions it WHERE it.id = $1`, [log.id]);
    return { student: (await getStudent(log.studentId))!, interaction: rows[0].log };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

interface StudentListRow extends StudentOverviewRow {
  feedback: StudentListEntry['feedback'];
}

// Student List: every student (none dropped), matched instructor details, feedback latest first.
export async function getStudentList(options: { instructorId?: string } = {}): Promise<StudentListEntry[]> {
  const { rows } = await getPool().query<StudentListRow>(
    `SELECT o.*, COALESCE(f.feedback, '[]'::json) AS feedback
     FROM student_overview o
     LEFT JOIN LATERAL (
       SELECT json_agg(${INTERACTION_JSON} ORDER BY it.date DESC, it.created_at DESC) AS feedback
       FROM interactions it
       WHERE it.student_id = o.id
     ) f ON true
     WHERE ($1::text IS NULL OR o.instructor_id = $1)
     ORDER BY o.name`,
    [options.instructorId ?? null]
  );

  return rows.map((row) => {
    const student = toStudent(row);
    return {
      id: student.id,
      name: student.name,
      degree: student.degree,
      section: student.section,
      hall: student.hall,
      level: student.level,
      currentTopic: student.currentTopic,
      currentStep: student.currentStep,
      status: student.status,
      interactionCount: student.interactionCount,
      lastInteractionDate: student.lastInteractionDate,
      instructor: {
        name: student.instructor, // first name only; raw value when not matched
        instructorId: row.instructor_id,
        fullName: row.instructor_full_name,
        email: row.instructor_email,
        match: row.instructor_match,
      },
      feedback: row.feedback,
    };
  });
}

interface InstructorRow {
  id: string;
  first_name: string;
  full_name: string;
  email: string;
  students: InstructorListEntry['students'];
}

// Instructor List: full names, each with their assigned students.
export const MIN_PASSWORD_LENGTH = 8;

// Admin: create an instructor + login and assign students, all in one transaction. Assigning moves a
// student from whoever had them (a student has exactly one instructor), so every count updates.
export async function createInstructor(input: NewInstructorInput): Promise<CreateInstructorResult> {
  const name = (input.name || '').trim().replace(/\s+/g, ' ');
  const firstName = (input.firstName || '').trim().replace(/\s+/g, ' ');
  const email = (input.email || '').trim().toLowerCase();
  const password = input.password || '';
  const studentIds = Array.from(new Set((input.studentIds || []).map((id) => String(id).trim().toUpperCase()).filter(Boolean)));

  if (name.length < 2) throw new ValidationError("Enter the instructor's full name.");
  if (!firstName) throw new ValidationError('Enter the name to show in the Student List.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('Enter a valid email address.');
  if (password.length < MIN_PASSWORD_LENGTH) throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // Serialise instructor creation so two admins can't take the same new id.
    await client.query('LOCK TABLE instructors IN SHARE ROW EXCLUSIVE MODE');

    const clash = await client.query<{ email: string }>(
      'SELECT email FROM instructors WHERE email = $1 UNION SELECT email FROM users WHERE email = $1',
      [email]
    );
    if (clash.rowCount) throw new ValidationError(`${email} is already used by another account.`);

    const directory = await loadDirectory(client);
    const sameName = directory.find((i) => normalizeInstructorName(i.firstName) === normalizeInstructorName(firstName));
    if (sameName) {
      throw new ValidationError(`"${firstName}" is already shown for ${sameName.name}. Use a distinct Student List name (e.g. "${firstName}-2").`);
    }

    const found = await client.query<{ id: string; name: string; previous: string | null }>(
      `SELECT s.id, s.name, i.full_name AS previous
       FROM students s LEFT JOIN instructors i ON i.id = s.instructor_id
       WHERE s.id = ANY($1::text[])`,
      [studentIds]
    );
    const missing = studentIds.filter((id) => !found.rows.some((r) => r.id === id));
    if (missing.length) throw new ValidationError(`These roll numbers are not in the database: ${missing.join(', ')}`);

    const { rows: [{ next }] } = await client.query<{ next: number }>(
      "SELECT COALESCE(MAX(substring(id from '^INS([0-9]+)$')::int), 0) + 1 AS next FROM instructors"
    );
    const id = `INS${String(next).padStart(3, '0')}`;

    await client.query(
      "INSERT INTO instructors (id, first_name, full_name, email, aliases) VALUES ($1, $2, $3, $4, '{}')",
      [id, firstName, name, email]
    );
    await client.query(
      "INSERT INTO users (id, instructor_id, name, email, role, password_hash) VALUES ($1, $1, $2, $3, 'instructor', $4)",
      [id, name, email, await hashPassword(password)]
    );
    if (studentIds.length) {
      await client.query(
        `UPDATE students SET instructor_id = $1, instructor_match = 'matched', instructor_raw = $2, updated_at = now()
         WHERE id = ANY($3::text[])`,
        [id, firstName, studentIds]
      );
    }
    await client.query('COMMIT');

    return {
      instructor: { id, name, firstName, email },
      assigned: found.rows
        .map((r) => ({ id: r.id, name: r.name, previousInstructor: r.previous }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Names and ids only, for the "Interaction Taken By" dropdown (any signed-in user).
export async function getInstructorOptions(): Promise<InstructorOption[]> {
  const { rows } = await getPool().query<{ id: string; first_name: string; full_name: string }>(
    'SELECT id, first_name, full_name FROM instructors ORDER BY full_name'
  );
  return rows.map((r) => ({ id: r.id, name: r.full_name, firstName: r.first_name }));
}

export async function getInstructorList(): Promise<InstructorListEntry[]> {
  const { rows } = await getPool().query<InstructorRow>(
    `SELECT i.id, i.first_name, i.full_name, i.email,
            COALESCE(
              json_agg(json_build_object(
                'id', o.id,
                'name', o.name,
                'level', 'Level ' || o.level,
                'currentTopic', o.current_topic,
                'currentStep', o.current_step,
                'lastInteractionDate', to_char(o.last_interaction_date, 'YYYY-MM-DD')
              ) ORDER BY o.name) FILTER (WHERE o.id IS NOT NULL),
              '[]'::json
            ) AS students
     FROM instructors i
     LEFT JOIN student_overview o ON o.instructor_id = i.id
     GROUP BY i.id
     ORDER BY i.full_name`
  );

  return rows.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    name: row.full_name,
    email: row.email,
    students: row.students,
  }));
}

// Students whose Student List instructor value could not be matched to exactly one instructor.
export async function getInstructorMatchIssues(): Promise<Array<{ id: string; name: string; instructorRaw: string; match: InstructorMatchStatus }>> {
  const { rows } = await getPool().query<{ id: string; name: string; instructor_raw: string; instructor_match: InstructorMatchStatus }>(
    `SELECT id, name, instructor_raw, instructor_match FROM students WHERE instructor_match <> 'matched' ORDER BY name`
  );
  return rows.map((row) => ({ id: row.id, name: row.name, instructorRaw: row.instructor_raw, match: row.instructor_match }));
}
