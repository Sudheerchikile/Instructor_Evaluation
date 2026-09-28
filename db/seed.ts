import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DirectoryInstructor, matchInstructor } from '../lib/instructorDirectory';
import { PENDING_STATUS, normalizeRecursionTopic, normalizeStepValue, normalizeTopicValue } from '../lib/storage';
import { Student } from '../lib/types';
import { coerceStep, getDefaultTopicForLevel, getTopicOptions } from '../lib/multiLevelCurriculum';
import { getPool, loadEnvForScripts } from './client';

// Imports the instructor directory and the Student List, matching each student's instructor
// (first name in the Student List) to a directory instructor. Interactions are NOT seeded: they only
// come from instructors logging them in the app (lib/data/initialInteractions.json is reference only).
//   npm run db:report  -> matching report only, no database needed
//   npm run db:seed    -> report + import
// Re-running is safe: instructors are upserted, new students are added, existing students keep their
// instructor (only unmatched ones are re-mapped) and progress, and interactions are never touched.

const dryRun = process.argv.includes('--dry-run');

// Source files are read at run time (not imported) so the deployed app builds without them.
// They hold personal data and are only needed on the machine that runs this one-time import.
function readJson<T>(relativePath: string): T {
  const file = join(process.cwd(), relativePath);
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    console.error(`Missing or invalid ${relativePath}. It is not in Git; get it from the project owner.`);
    process.exit(1);
  }
}

const INSTRUCTOR_DIRECTORY = readJson<DirectoryInstructor[]>('lib/data/instructors.json');
const rawStudents = readJson<Student[]>('lib/data/students.json');

function levelNumber(level: string | undefined): number {
  const match = /^Level\s+(\d+)$/.exec((level || '').trim());
  const n = match ? Number(match[1]) : 0;
  return n >= 0 && n <= 7 ? n : 0;
}

const students = rawStudents.map((s) => {
  const match = matchInstructor(INSTRUCTOR_DIRECTORY, s.instructor, s.instructorEmail);
  const level = levelNumber(s.level);
  const levelLabel = `Level ${level}`;
  // Sheet values not valid for the level (e.g. Level 0 rows with topic "Introduction") fall back to the level's default topic.
  const sheetTopic = normalizeRecursionTopic(normalizeTopicValue(s.currentTopic), levelLabel);
  const topic = getTopicOptions(levelLabel).includes(sheetTopic) ? sheetTopic : getDefaultTopicForLevel(levelLabel);
  return {
    id: s.id,
    name: s.name,
    degree: s.degree,
    section: s.section,
    hall: s.hall,
    instructorRaw: (s.instructor || '').trim(),
    instructorId: match.instructor?.id ?? null,
    instructorMatch: match.status,
    candidates: match.candidates.map((c) => `${c.name} <${c.email}>`),
    level,
    currentTopic: topic,
    currentStep: coerceStep(levelLabel, topic, normalizeStepValue(s.currentStep)),
    // Sheet statuses like "Pending Interaction 1" carry round numbers; new students all start pending.
    status: PENDING_STATUS,
  };
});

function printReport() {
  const byStatus = { matched: 0, ambiguous: 0, unmatched: 0 };
  const perInstructor = new Map<string, number>();
  for (const s of students) {
    byStatus[s.instructorMatch]++;
    if (s.instructorId) perInstructor.set(s.instructorId, (perInstructor.get(s.instructorId) ?? 0) + 1);
  }

  console.log(`Instructors in directory: ${INSTRUCTOR_DIRECTORY.length}`);
  console.log(`Students: ${students.length} (matched ${byStatus.matched}, ambiguous ${byStatus.ambiguous}, unmatched ${byStatus.unmatched})`);
  console.log('\nStudent List value -> instructor (students):');

  const rawToInstructor = new Map<string, { label: string; count: number }>();
  for (const s of students) {
    const entry = INSTRUCTOR_DIRECTORY.find((i) => i.id === s.instructorId);
    const label = entry ? `${entry.id}  ${entry.firstName}  |  ${entry.name}  <${entry.email}>` : `${s.instructorMatch.toUpperCase()}`;
    const current = rawToInstructor.get(s.instructorRaw) ?? { label, count: 0 };
    current.count++;
    rawToInstructor.set(s.instructorRaw, current);
  }
  for (const [raw, { label, count }] of [...rawToInstructor.entries()].sort()) {
    console.log(`  ${raw.padEnd(12)} -> ${label}  (${count})`);
  }

  const problems = students.filter((s) => s.instructorMatch !== 'matched');
  if (problems.length) {
    console.log('\n⚠ Students needing an instructor mapping:');
    for (const s of problems) {
      console.log(`  ${s.id} ${s.name}: "${s.instructorRaw}" is ${s.instructorMatch}${s.candidates.length ? ` (candidates: ${s.candidates.join(', ')})` : ''}`);
    }
  }

  const unused = INSTRUCTOR_DIRECTORY.filter((i) => !perInstructor.has(i.id));
  if (unused.length) console.log(`\nDirectory instructors with no students: ${unused.map((i) => i.name).join(', ')}`);
}

async function importData() {
  loadEnvForScripts();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO instructors (id, first_name, full_name, email, aliases)
       SELECT id, first_name, full_name, email, string_to_array(aliases, '|')
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[]) AS t(id, first_name, full_name, email, aliases)
       ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, full_name = EXCLUDED.full_name,
         email = EXCLUDED.email, aliases = EXCLUDED.aliases`,
      [
        INSTRUCTOR_DIRECTORY.map((i) => i.id),
        INSTRUCTOR_DIRECTORY.map((i) => i.firstName),
        INSTRUCTOR_DIRECTORY.map((i) => i.name),
        INSTRUCTOR_DIRECTORY.map((i) => i.email),
        INSTRUCTOR_DIRECTORY.map((i) => i.aliases.join('|')),
      ]
    );

    await client.query(
      `INSERT INTO students (id, name, degree, section, hall, instructor_raw, instructor_id, instructor_match, level, current_topic, current_step, status)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::smallint[], $10::text[], $11::text[], $12::text[])
       ON CONFLICT (id) DO UPDATE SET instructor_raw = EXCLUDED.instructor_raw, instructor_id = EXCLUDED.instructor_id,
         instructor_match = EXCLUDED.instructor_match, updated_at = now()
       -- Never overwrite an assignment made in the app (e.g. by "Add instructor"); only fill unmatched ones.
       WHERE students.instructor_match <> 'matched'`,
      [
        students.map((s) => s.id),
        students.map((s) => s.name),
        students.map((s) => s.degree),
        students.map((s) => s.section),
        students.map((s) => s.hall),
        students.map((s) => s.instructorRaw),
        students.map((s) => s.instructorId),
        students.map((s) => s.instructorMatch),
        students.map((s) => s.level),
        students.map((s) => s.currentTopic),
        students.map((s) => s.currentStep),
        students.map((s) => s.status),
      ]
    );

    await client.query('COMMIT');
    const { rows } = await client.query<{ current_database: string }>('SELECT current_database()');
    console.log(`\nImported into "${rows[0].current_database}": ${INSTRUCTOR_DIRECTORY.length} instructors, ${students.length} students.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

printReport();
if (!dryRun) {
  importData().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
