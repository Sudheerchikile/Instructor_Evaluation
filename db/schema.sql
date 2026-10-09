-- KKH DSA Analytics: PostgreSQL schema (database: kkh_dsa_analytics)
-- Safe to re-run: every statement is idempotent.
--
-- Relationship:  instructors 1 ── * students 1 ── * interactions
-- instructors and students are reference data (imported once, edited rarely);
-- interactions is the only table expected to grow.

-- Instructor directory (source: lib/data/instructors.json)
CREATE TABLE IF NOT EXISTS instructors (
  id          TEXT PRIMARY KEY,                    -- e.g. INS010
  first_name  TEXT NOT NULL,                       -- shown in the Student List
  full_name   TEXT NOT NULL,                       -- shown in the Instructor List
  email       TEXT NOT NULL UNIQUE,                -- company email
  aliases     TEXT[] NOT NULL DEFAULT '{}',        -- spelling variants / batch labels, e.g. 'Gaurav - 25'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instructors_first_name_idx ON instructors (lower(first_name));

-- Login accounts, created only by `npm run db:users` (no self-registration). Admins have no instructor_id.
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  instructor_id  TEXT UNIQUE REFERENCES instructors(id),
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  role           TEXT NOT NULL CHECK (role IN ('admin', 'instructor')),
  hall           TEXT,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every instructor account must point at a directory instructor; admins must not.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_instructor_consistent') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_instructor_consistent
      CHECK ((role = 'instructor') = (instructor_id IS NOT NULL));
  END IF;
END $$;

-- Login sessions. Only a SHA-256 hash of the cookie token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Students (source: lib/data/students.json)
CREATE TABLE IF NOT EXISTS students (
  id                TEXT PRIMARY KEY,              -- roll number
  name              TEXT NOT NULL,
  degree            TEXT NOT NULL,
  section           TEXT NOT NULL,
  hall              TEXT NOT NULL,
  instructor_raw    TEXT NOT NULL DEFAULT '',      -- instructor value exactly as in the Student List
  instructor_id     TEXT REFERENCES instructors(id),
  instructor_match  TEXT NOT NULL DEFAULT 'unmatched'
                    CHECK (instructor_match IN ('matched', 'ambiguous', 'unmatched')),
  level             SMALLINT NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 7),
  current_topic     TEXT NOT NULL DEFAULT 'Introduction',
  current_step      TEXT NOT NULL DEFAULT 'Introduction',
  status            TEXT NOT NULL DEFAULT 'Pending Evaluation',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT students_match_consistent CHECK ((instructor_match = 'matched') = (instructor_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS students_instructor_idx ON students (instructor_id);
-- New students start at Level 0 / Introduction / Introduction.
ALTER TABLE students ALTER COLUMN current_topic SET DEFAULT 'Introduction';
ALTER TABLE students ALTER COLUMN status SET DEFAULT 'Pending Evaluation';
-- Subtopic within the current topic (lib/multiLevelCurriculum.ts); NULL for topics without subtopics.
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_subtopic TEXT;

-- A topic change clears the subtopic unless the same update sets a new one, so a stale subtopic can't
-- survive a topic change made by any code path (including app builds that don't know about subtopics).
CREATE OR REPLACE FUNCTION clear_subtopic_on_topic_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_topic IS DISTINCT FROM OLD.current_topic AND NEW.current_subtopic IS NOT DISTINCT FROM OLD.current_subtopic THEN
    NEW.current_subtopic := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS students_clear_subtopic ON students;
CREATE TRIGGER students_clear_subtopic
  BEFORE UPDATE OF current_topic ON students
  FOR EACH ROW EXECUTE FUNCTION clear_subtopic_on_topic_change();

-- Interaction / feedback history. Field names mirror InteractionLog in lib/types.ts.
CREATE TABLE IF NOT EXISTS interactions (
  id                        TEXT PRIMARY KEY,
  student_id                TEXT NOT NULL REFERENCES students(id),
  student_name              TEXT NOT NULL,          -- snapshot at log time
  instructor_name           TEXT NOT NULL DEFAULT '', -- "interaction taken by", as entered
  instructor_email          TEXT,
  taken_by_instructor_id    TEXT REFERENCES instructors(id),
  assigned_instructor_id    TEXT REFERENCES instructors(id),
  assigned_instructor_name  TEXT,                   -- snapshot at log time
  level                     SMALLINT CHECK (level BETWEEN 0 AND 7), -- student's level at log time
  current_step              TEXT,                   -- student's step at log time
  topics                    TEXT NOT NULL DEFAULT '',
  status_post_interaction   TEXT NOT NULL,
  rating                    NUMERIC(2, 1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  questions_asked           TEXT NOT NULL DEFAULT '',
  remarks                   TEXT NOT NULL DEFAULT '',
  performed_well            TEXT NOT NULL DEFAULT '',
  improvement_areas         TEXT NOT NULL DEFAULT '',
  tweaked_questions         TEXT NOT NULL DEFAULT '',
  action_items              TEXT NOT NULL DEFAULT '',
  meet_recording            TEXT NOT NULL DEFAULT '',
  granola_transcript        TEXT NOT NULL DEFAULT '',
  interaction_round         SMALLINT NOT NULL DEFAULT 1,
  date                      DATE NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS interactions_student_date_idx ON interactions (student_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS interactions_date_idx ON interactions (date);
-- Edit history: last edit time and who made it (no FK, so removing a login never blocks this).
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS updated_by TEXT;
-- Student's subtopic at log time (NULL for topics without subtopics and for older logs).
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS current_subtopic TEXT;

-- Deleted interactions (duplicates, wrong details). A delete moves the row here, so every query, count and
-- status (all read `interactions`) drops it with no extra filter. `data` is the full row as JSON, so a
-- mistaken delete can be restored. deleted_by is the user id (no FK, so removing a login never blocks this).
CREATE TABLE IF NOT EXISTS deleted_interactions (
  id             TEXT PRIMARY KEY,
  student_id     TEXT NOT NULL,
  data           JSONB NOT NULL,
  delete_reason  TEXT NOT NULL,
  deleted_by     TEXT NOT NULL,
  deleted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deleted_interactions_student_idx ON deleted_interactions (student_id);

-- Student + matched instructor + derived interaction stats.
-- interactionCount and lastInteractionDate are computed, never stored, so they can't drift.
-- level_status is the student's standing at their CURRENT level, from the latest interaction logged at
-- that level (older logs without a level were all Level 0). No interaction at the current level means
-- 'Pending Evaluation', so a promoted student is pending again until evaluated at the new level.
-- Dropped and re-created (not CREATE OR REPLACE): s.* gains columns over time, which would move later columns.
DROP VIEW IF EXISTS student_overview;
CREATE VIEW student_overview AS
SELECT
  s.*,
  i.first_name  AS instructor_first_name,
  i.full_name   AS instructor_full_name,
  i.email       AS instructor_email,
  COALESCE(x.interaction_count, 0) AS interaction_count,
  x.last_interaction_date,
  CASE cur.status_post_interaction
    WHEN 'Need to Revisit' THEN 'Needs Revisit'
    WHEN 'Cleared' THEN 'Cleared'
    WHEN 'In Progress' THEN 'In Progress'
    ELSE 'Pending Evaluation'
  END AS level_status,
  COALESCE(cur.level_interaction_count, 0) AS level_interaction_count
FROM students s
LEFT JOIN instructors i ON i.id = s.instructor_id
LEFT JOIN (
  SELECT student_id, count(*)::int AS interaction_count, max(date) AS last_interaction_date
  FROM interactions
  GROUP BY student_id
) x ON x.student_id = s.id
LEFT JOIN LATERAL (
  SELECT it.status_post_interaction, count(*) OVER ()::int AS level_interaction_count
  FROM interactions it
  WHERE it.student_id = s.id AND COALESCE(it.level, 0) = s.level
  ORDER BY it.date DESC, it.created_at DESC
  LIMIT 1
) cur ON true;

-- Level history: one row per level change, used for the Analytics "Level Conversions" counts.
-- Rows are written by the trigger below whenever students.level changes, from any code path, so the
-- deployed app needs no change to start recording. change_date is the calendar day in India (the DB
-- clock is UTC). changed_by is the user id the API sets with set_config('app.user_id', ...).
-- source 'backfill' rows were reconstructed once from interaction history (see below); their date is an
-- estimate: the logged date of the last interaction before the change.
CREATE TABLE IF NOT EXISTS level_changes (
  id           BIGSERIAL PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_level   SMALLINT NOT NULL CHECK (from_level BETWEEN 0 AND 7),
  to_level     SMALLINT NOT NULL CHECK (to_level BETWEEN 0 AND 7),
  change_date  DATE NOT NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by   TEXT,                               -- user id (no FK, so removing a login never blocks this)
  source       TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'backfill')),
  CHECK (from_level <> to_level)
);
CREATE INDEX IF NOT EXISTS level_changes_date_idx ON level_changes (change_date);
CREATE INDEX IF NOT EXISTS level_changes_student_idx ON level_changes (student_id, change_date);

CREATE OR REPLACE FUNCTION record_level_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO level_changes (student_id, from_level, to_level, change_date, changed_by)
  VALUES (NEW.id, OLD.level, NEW.level, (now() AT TIME ZONE 'Asia/Kolkata')::date,
          NULLIF(current_setting('app.user_id', true), ''));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS students_level_change ON students;
CREATE TRIGGER students_level_change
  AFTER UPDATE OF level ON students
  FOR EACH ROW WHEN (OLD.level IS DISTINCT FROM NEW.level)
  EXECUTE FUNCTION record_level_change();

-- One-time data migrations, so re-running this file never repeats them.
CREATE TABLE IF NOT EXISTS data_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill (runs once): level changes made before level_changes existed, rebuilt from interactions.
-- Each interaction stores the student's level when it was saved (NULL = older logs, all Level 0), so
-- walking a student's interactions in save order, a change between two consecutive logs, or between the
-- last log and the current level, is a level change. It is dated by the logged date of the interaction
-- just before the change (normally the one where the student cleared the level).
WITH run AS (
  INSERT INTO data_migrations (name) VALUES ('level_changes_backfill') ON CONFLICT (name) DO NOTHING RETURNING name
), logs AS (
  SELECT it.student_id, it.date, it.created_at, COALESCE(it.level, 0) AS lvl,
         lead(COALESCE(it.level, 0)) OVER (PARTITION BY it.student_id ORDER BY it.created_at, it.id) AS next_lvl
  FROM interactions it
)
INSERT INTO level_changes (student_id, from_level, to_level, change_date, changed_at, source)
SELECT l.student_id, l.lvl, COALESCE(l.next_lvl, s.level), l.date, l.created_at, 'backfill'
FROM logs l
JOIN students s ON s.id = l.student_id
WHERE COALESCE(l.next_lvl, s.level) <> l.lvl
  AND EXISTS (SELECT 1 FROM run);

-- One-time: students already on a topic that now has subtopics start at its first subtopic (decided 2026-10-09).
-- Keep in step with SUBTOPIC_MAP in lib/multiLevelCurriculum.ts.
WITH run AS (
  INSERT INTO data_migrations (name) VALUES ('subtopics_default_level1') ON CONFLICT (name) DO NOTHING RETURNING name
)
UPDATE students SET current_subtopic = CASE current_topic WHEN 'Maths' THEN 'LCM & GCD' WHEN 'STL' THEN 'Set / Unordered Set' END
WHERE level = 1 AND current_topic IN ('Maths', 'STL') AND current_subtopic IS NULL
  AND EXISTS (SELECT 1 FROM run);
