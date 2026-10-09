import type { PoolClient } from 'pg';
import { getPool } from './client';
import { CreateInstructorResult, InstructorListEntry, InstructorMatchStatus, InstructorOption, InstructorUser, InteractionLog, LevelConversion, NewInstructorInput, Student, StudentListEntry } from '../lib/types';
import { DirectoryInstructor, matchInstructor } from '../lib/instructorDirectory';
import { LEVELS, coerceStep, coerceSubtopic, getDefaultTopicForLevel, getStepOptionsForTopic, getSubtopicOptions, getTopicOptions } from '../lib/multiLevelCurriculum';
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
    'currentSubtopic', it.current_subtopic,
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
  current_subtopic: string | null;
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
    currentSubtopic: row.current_subtopic,
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

// Level / topic / subtopic / step change from the "My Students" page. Invalid combinations are rejected. A level
// change without an explicit topic resets topic, subtopic and step to that level's defaults; a topic change resets
// subtopic and step; a subtopic change restarts the step (each subtopic has its own run of steps).
export async function updateStudentProgress(
  id: string,
  patch: { level?: string; currentTopic?: string; currentSubtopic?: string | null; currentStep?: string },
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

  const subtopicOptions = getSubtopicOptions(level, topic);
  const subtopic = patch.currentSubtopic !== undefined
    ? patch.currentSubtopic || null
    : coerceSubtopic(level, topic, levelChanged || topicChanged ? undefined : current.currentSubtopic);
  if (subtopic ? !subtopicOptions.includes(subtopic) : subtopicOptions.length > 0) {
    throw new ValidationError(subtopic ? `Subtopic "${subtopic}" is not part of ${topic}.` : `Choose a subtopic for ${topic}.`);
  }
  const subtopicChanged = subtopic !== (current.currentSubtopic ?? null);

  const step = patch.currentStep ?? (levelChanged || topicChanged || subtopicChanged ? coerceStep(level, topic, undefined) : coerceStep(level, topic, current.currentStep));
  if (!getStepOptionsForTopic(level, topic).includes(step)) throw new ValidationError(`Step "${step}" is not valid for ${topic}.`);

  // A level change is recorded in level_changes by a DB trigger; app.user_id tells it who made the change.
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [actor.id]);
    await client.query(
      'UPDATE students SET level = $2, current_topic = $3, current_subtopic = $4, current_step = $5, updated_at = now() WHERE id = $1',
      [id, levelNumber(level), topic, subtopic, step]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getStudent(id);
}

// Level conversions for Analytics: one entry per student per level crossed upward, per day (IST).
// All of a student's changes on one day are netted from the first level that day to the last, so a mistaken
// promotion undone the same day counts nothing, and a net move from Level N to Level M (M > N) counts once
// for each step N→N+1 … M-1→M. Net moves down count nothing. `estimated` marks days rebuilt from interactions.
export async function getLevelConversions(): Promise<LevelConversion[]> {
  const { rows } = await getPool().query<LevelConversion>(
    `WITH net AS (
       SELECT student_id, change_date,
              (array_agg(from_level ORDER BY changed_at, id))[1] AS start_level,
              (array_agg(to_level ORDER BY changed_at DESC, id DESC))[1] AS end_level,
              bool_or(source = 'backfill') AS estimated
       FROM level_changes
       GROUP BY student_id, change_date
     )
     SELECT to_char(n.change_date, 'YYYY-MM-DD') AS "date", n.student_id AS "studentId",
            'Level ' || step AS "fromLevel", 'Level ' || (step + 1) AS "toLevel", n.estimated
     FROM net n
     CROSS JOIN LATERAL generate_series(n.start_level, n.end_level - 1) AS step
     WHERE n.end_level > n.start_level
     ORDER BY n.change_date DESC, step, n.student_id`
  );
  return rows;
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
  student: { instructorId?: string | null; level?: string; currentSubtopic?: string | null; currentStep?: string },
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
       granola_transcript, interaction_round, date, created_at, created_by, current_subtopic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
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
      // Snapshot like level/step: the form sends it; older clients don't, so fall back to the student's.
      (log.currentSubtopic !== undefined ? log.currentSubtopic : student.currentSubtopic) ?? null,
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
      currentSubtopic: student.currentSubtopic,
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
  const studentIds = cleanRollNumbers(input.studentIds);

  if (name.length < 2) throw new ValidationError("Enter the instructor's full name.");
  if (!firstName) throw new ValidationError('Enter the name to show in the Student List.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('Enter a valid email address.');
  if (password.length < MIN_PASSWORD_LENGTH) throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // Serialise instructor creation so two admins can't take the same new id.
    await client.query('LOCK TABLE instructors IN SHARE ROW EXCLUSIVE MODE');

    const existing = await client.query<{ full_name: string }>('SELECT full_name FROM instructors WHERE email = $1', [email]);
    if (existing.rowCount) {
      throw new ValidationError(`${existing.rows[0].full_name} already has an account (${email}). To give them students, use "Assign students" on their row.`);
    }
    const clash = await client.query<{ email: string }>('SELECT email FROM users WHERE email = $1', [email]);
    if (clash.rowCount) throw new ValidationError(`${email} is already used by another account.`);

    const directory = await loadDirectory(client);
    const sameName = directory.find((i) => normalizeInstructorName(i.firstName) === normalizeInstructorName(firstName));
    if (sameName) {
      throw new ValidationError(`"${firstName}" is already shown for ${sameName.name}. Use a distinct Student List name (e.g. "${firstName}-2").`);
    }

    const found = await findStudentsToAssign(client, studentIds);

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
    await moveStudents(client, id, firstName, studentIds);
    await client.query('COMMIT');

    return { instructor: { id, name, firstName, email }, assigned: found };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Roll numbers → students with their current instructor (full name). Any unknown roll number is an error.
async function findStudentsToAssign(client: PoolClient, studentIds: string[]): Promise<CreateInstructorResult['assigned']> {
  const { rows } = await client.query<{ id: string; name: string; previous: string | null; previous_id: string | null }>(
    `SELECT s.id, s.name, i.full_name AS previous, i.id AS previous_id
     FROM students s LEFT JOIN instructors i ON i.id = s.instructor_id
     WHERE s.id = ANY($1::text[])`,
    [studentIds]
  );
  const missing = studentIds.filter((id) => !rows.some((r) => r.id === id));
  if (missing.length) throw new ValidationError(`These roll numbers are not in the database: ${missing.join(', ')}`);
  return rows
    .map((r) => ({ id: r.id, name: r.name, previousInstructor: r.previous, previousInstructorId: r.previous_id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// A student has exactly one instructor, so assigning moves them from whoever had them.
async function moveStudents(client: PoolClient, instructorId: string, firstName: string, studentIds: string[]) {
  if (!studentIds.length) return;
  await client.query(
    `UPDATE students SET instructor_id = $1, instructor_match = 'matched', instructor_raw = $2, updated_at = now()
     WHERE id = ANY($3::text[])`,
    [instructorId, firstName, studentIds]
  );
}

const cleanRollNumbers = (ids: string[] | undefined) =>
  Array.from(new Set((ids || []).map((id) => String(id).trim().toUpperCase()).filter(Boolean)));

// Admin: assign students to an existing instructor, moving them from their current instructor, in one
// transaction. Students who already belong to this instructor are left as they are.
export async function assignStudentsToInstructor(instructorId: string, rollNumbers: string[]): Promise<CreateInstructorResult> {
  const studentIds = cleanRollNumbers(rollNumbers);
  if (!studentIds.length) throw new ValidationError('Enter at least one roll number.');

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: [instructor] } = await client.query<{ id: string; first_name: string; full_name: string; email: string }>(
      'SELECT id, first_name, full_name, email FROM instructors WHERE id = $1 FOR UPDATE',
      [instructorId]
    );
    if (!instructor) throw new ValidationError('Instructor not found.');

    const found = await findStudentsToAssign(client, studentIds);
    const toMove = found.filter((s) => s.previousInstructorId !== instructor.id);
    await moveStudents(client, instructor.id, instructor.first_name, toMove.map((s) => s.id));
    await client.query('COMMIT');

    return {
      instructor: { id: instructor.id, name: instructor.full_name, firstName: instructor.first_name, email: instructor.email },
      assigned: toMove,
      alreadyAssigned: found.length - toMove.length,
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
                'currentSubtopic', o.current_subtopic,
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
