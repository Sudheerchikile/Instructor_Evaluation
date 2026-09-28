import type { PoolClient } from 'pg';
import { getPool } from './client';
import { InstructorListEntry, InstructorMatchStatus, InstructorOption, InstructorUser, InteractionLog, Student, StudentListEntry } from '../lib/types';
import { DirectoryInstructor, matchInstructor } from '../lib/instructorDirectory';
import { LEVELS, coerceStep, getDefaultTopicForLevel, getStepOptionsForTopic, getTopicOptions } from '../lib/multiLevelCurriculum';
import { statusAfterInteraction } from '../lib/storage';

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
    'createdAt', it.created_at
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
export async function addInteraction(log: InteractionLog, actor: InstructorUser): Promise<{ student: Student; interaction: InteractionLog }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log.date || '')) throw new ValidationError('Interaction date must be YYYY-MM-DD.');
  if (!(Number(log.rating) >= 0 && Number(log.rating) <= 5)) throw new ValidationError('Rating must be between 0 and 5.');

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
