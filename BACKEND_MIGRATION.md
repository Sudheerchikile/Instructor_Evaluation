# Backend Migration Notes: KKH DSA Analytics

This document records how the app stores data today (browser localStorage and bundled JSON files), which changes have been made so far, and what a backend has to take over. Read it together with [context.jsx](context.jsx) and [claude-handoff.md](claude-handoff.md).

Last updated: 2026-09-27

---

## 1. Why this matters: data is not shared today

Every read and write goes to the **browser's localStorage**. As a result:

- Each instructor's browser keeps its **own separate copy** of all 892 students and all interactions. If Instructor A logs an interaction, nobody else sees it, and the manager's Analytics never includes it.
- Clearing browser data, or switching browsers or devices, resets everything to the seed JSON.
- Accounts registered on one machine don't exist on any other machine.

So the backend isn't only a storage change. It is what makes the app multi-user at all.

---

## 1a. Database: decided on 2026-09-27

- **Engine:** PostgreSQL. **Database name:** `kkh_dsa_analytics`. **Driver:** `pg` (node-postgres), with SQL kept in plain files. There is no ORM.
- **Why Postgres:** the data is relational (instructor 1→* students 1→* interactions) and needs joins, foreign keys and aggregates for analytics. The instructor and student tables are reference data that rarely change, and only `interactions` grows. At about 900 students and a few dozen interactions each, that is small for Postgres. Any hosted Postgres works (Neon, Supabase, RDS, and so on).
- **Connection:** `DATABASE_URL` in `.env.local` (template in [.env.example](.env.example)).

| File | Purpose |
|---|---|
| [db/schema.sql](db/schema.sql) | Tables `instructors`, `users`, `students`, `interactions`, plus the view `student_overview`. Safe to re-run |
| [db/client.ts](db/client.ts) | Shared connection pool. DATE values come back as `'YYYY-MM-DD'` strings and NUMERIC values as numbers |
| [db/migrate.ts](db/migrate.ts) | Applies `schema.sql` |
| [db/seed.ts](db/seed.ts) | Matches instructors, prints a report, and imports `instructors.json` and `students.json` (no interactions). Re-running it refreshes only the instructor mapping and keeps student progress |
| [db/queries.ts](db/queries.ts) | `getStudentList()`, `getInstructorList()`, `getInstructorMatchIssues()`: the read queries for the upcoming API routes |

| Command | What it does |
|---|---|
| `npm run db:report` | Matching report only; **no database needed** |
| `npm run db:migrate` | Create or update the tables |
| `npm run db:seed` | Import the data |
| `npm run db:setup` | Migrate, then seed |

`interactionCount` and `lastInteractionDate` are **computed** in the `student_overview` view (`count(*)` and `max(date)` over interactions). They are not stored, so they can't drift out of sync.

### Student List and Instructor List (API shapes, in [lib/types.ts](lib/types.ts))
- **`StudentListEntry`**: every student field, plus `instructor: { name /* first name only */, instructorId, fullName, email, match }`, plus `feedback: InteractionLog[]` (latest first, `[]` when there are none). Students with no interactions are kept.
- **`InstructorListEntry`**: `{ id, firstName, name /* full name */, email, students: [{ id, name, level, currentTopic, currentStep, lastInteractionDate }] }`.
- Each feedback entry uses the existing `InteractionLog` field names. `questionsAsked` holds the student's questions/input, and `remarks`, `performedWell`, `improvementAreas` and `actionItems` hold the instructor's feedback and notes. `level` and `currentStep` are new: they record the student's level and step at the moment the interaction was logged.

---

## 2. Where data lives today

### 2.1 localStorage keys (all defined in [lib/storage.ts](lib/storage.ts))

| Key | Contents | Written by | Moves to backend? |
|---|---|---|---|
| `kkh_dsa_students_v2` | `Student[]`, all students | `getStoredStudents`, `saveStudents`, `addInteractionLog` | **Yes**: `students` table |
| `kkh_dsa_interactions_v2` | `InteractionLog[]` | `getStoredInteractions`, `saveInteractions`, `addInteractionLog` | **Yes**: `interactions` table |
| `kkh_dsa_instructors_v2` | `InstructorUser[]`, accounts plus password hashes | `getRegisteredInstructors`, `registerInstructor` | **Yes**: `users` table |
| `kkh_dsa_current_user_v2` | The logged-in `InstructorUser` (**including `passwordHash`**) | `saveStoredCurrentUser`, `clearStoredInstructorSession` | **Yes**: replace with a server session |
| `kkh_theme` | `"light"` or `"dark"` ([app/page.tsx:34](app/page.tsx#L34)) | Home page | No, this is a UI preference and can stay local |

### 2.2 Cookie

- `kkh_auth_session` holds **only the user id**, unsigned ([lib/storage.ts:105](lib/storage.ts#L105)).
- [proxy.ts](proxy.ts) only checks that the cookie **exists** before allowing any page except `/login`. It never checks the value.

### 2.3 Bundled seed files (`lib/data/`)

| File | Contents | Used by | Backend plan |
|---|---|---|---|
| `students.json` (~320 KB) | 892 students, all at Level 0, with 30 instructor names (e.g. `Adarsh`, `Gaurav - 25`, `Gaurav - 26`, `SUDHANVA`); 570 BITS / 322 CDU | `storage.ts`, used as the seed when localStorage is empty | One-time import into the DB |
| `initialInteractions.json` | 1 sample interaction | **Nothing: reference only, do not use** | Not imported; its row was deleted from the DB on 2026-09-27 |
| `instructors.json` | **Not in Git** (it holds staff emails; copy `instructors.example.json` and fill it in). **Instructor directory**: 30 instructors with `id` (`INS001`–`INS030`), `firstName` (shown in the Student List), `name` (full name, shown in the Instructor List), `email` (company email) and `aliases` (spelling variants and batch labels only, e.g. `Gaurav - 25`, `Ranith`) | `storage.ts` (`INSTRUCTOR_DIRECTORY`) | Import into `users`; this file is the name → email mapping table |
| `curriculum.json` | 8 curriculum steps with questions, time limits, hint rules and pass criteria (`CurriculumStep[]`) | [components/InteractionRoom.tsx](components/InteractionRoom.tsx) only | Could stay static; move to the DB only if admins must edit it |

### 2.4 Hard-coded data inside the code

- **Preset account:** only Admin (`admin@kkh.edu` / `admin`) is hard-coded in `storage.ts`. The 5 fake demo instructors were removed on 2026-09-27. Instructors register themselves with their company email (§6.1).
- **The curriculum map (levels → topics → steps)** is copied in **5 places**, and all copies must match:
  1. `getDefaultStepForLevel` in [lib/storage.ts](lib/storage.ts)
  2. `getDefaultTopicForLevel` in [lib/storage.ts](lib/storage.ts)
  3. `LEVEL_STEP_MAP`, `LEVEL_TOPIC_MAP`, `TOPIC_STEP_OVERRIDES` and `topicOptions` in [components/StudentRosterTable.tsx](components/StudentRosterTable.tsx)
  4. `topicList` and the `normalizeTopic` regexes in [components/AnalyticsDashboard.tsx](components/AnalyticsDashboard.tsx)
  5. [context.jsx](context.jsx) (documentation only)

  [lib/multiLevelCurriculum.ts](lib/multiLevelCurriculum.ts) is empty. It is the natural single source for this data, whether or not the data later moves to the DB.

### 2.5 Empty placeholder components

`AddStudentModal.tsx`, `AssignInstructorModal.tsx`, `CurriculumRubricView.tsx` and `InstructorAuthModal.tsx` contain only `export {};`. As a result, there is **currently no UI to add students or reassign instructors**. Those only happen by editing `students.json`.

---

## 3. Data model (from [lib/types.ts](lib/types.ts))

### Student
| Field | Type | Notes |
|---|---|---|
| `id` | string | Roll number, e.g. `N24H01A0061`. Natural primary key |
| `name` | string | |
| `degree` | string | `BITS` or `CDU` (the filter hard-codes these two) |
| `section` | string | e.g. `S002` |
| `hall` | string | `Hall 1` to `Hall 14` |
| `instructor` | string | **First name only**, for display in the Student List (the raw value if it couldn't be matched) |
| `instructorEmail` | string? | Matched instructor's company email: **the key used to join students to instructors** (§6.1) |
| `instructorId` | string? | Matched instructor's directory id (`INS0xx`) |
| `instructorFullName` | string? | Matched instructor's full name (used by the Instructor List and interaction snapshots) |
| `instructorMatch` | `'matched' \| 'ambiguous' \| 'unmatched'` | Result of matching. Anything other than `matched` shows a warning badge in the student table |
| `level` | string | `"Level 0"` to `"Level 7"`. Note: the `DSALevel` type (`0-4`) exists but is unused |
| `currentTopic` | string? | Must be one of that level's topics (§4) |
| `currentStep` | string? | Must be one of that topic's steps (§4) |
| `status` | string | Free text written by `addInteractionLog` (§5.2) |
| `interactionCount` | number | Derived; could be computed from the interactions table |
| `lastInteractionDate` | string \| null | Derived |

### InteractionLog
| Field | Notes |
|---|---|
| `id`, `studentId` | `studentId` is a foreign key to Student |
| `studentName`, `assignedInstructorName` | **Snapshots** taken when the log is saved. Keep them as history even after adding foreign keys |
| `instructorName`, `instructorEmail` | Who took the interaction. Typed by hand or taken from the pasted row, **not** from the logged-in user |
| `topics`, `statusPostInteraction` (`Need to Revisit` / `Cleared` / `In Progress`), `rating` (0–5) | |
| `questionsAsked`, `remarks`, `performedWell`, `improvementAreas`, `tweakedQuestions`, `actionItems` | Long free text |
| `meetRecording` | URL |
| `granolaTranscript` | Raw pasted text |
| `interactionRound`, `date`, `createdAt` | |

### InstructorUser
`id`, `name`, `email`, `role` (`admin` or `instructor`), `hall?`, `passwordHash`.

---

## 4. Curriculum: levels, topics and steps (current, after the 2026-09-27 changes)

| Level | Topics | Steps |
|---|---|---|
| Level 0 | Introduction, Data Types, If else, Loops, Traversal, Time & Space Complexity analysis, Pattern Questions | The same 7 items as the topics |
| Level 1 | Maths, STL, Array - Basics, Arrays, String | 7 steps (1.1 → 3.2) |
| Level 2 | **Recursion - Basics**, Sorting, Binary Search | 9 steps (1.1 → 4.2) |
| Level 3 | Two pointers / Sliding window, Greedy Algorithms | 9 steps |
| Level 4 | Bit Manipulation, Stack & Queues, Stack - Monotonic Stack | 9 steps |
| Level 5 | Heaps / PQ's, Linked list, **Recursion - Advanced**, AdHoc | 9 steps |
| Level 6 | Dynamic Programming | 9 steps |
| Level 7 | Binary Trees, Binary Search Trees, Graphs, Advanced Graph | 9 steps |

The steps, in order:
`1.1 Concept & Prerequisites`, `1.2 Complexity & Reasoning`, `1.3 Concept Explanation + own testCase / Example`, `2.1 easy - standard question`, `2.2 easy - tweaked question`, `3.1 medium standard question`, `3.2 medium tweaked question`, `4.1 hard standard question`, `4.2 hard tweaked question`.

Level 1 topics stop at 3.2.

**Behaviour to keep:** changing a student's level resets their topic and step to that level's first entries ([app/page.tsx:67](app/page.tsx#L67)).

---

## 5. Business logic that has to move to (or be repeated on) the server

Today all of this runs in the browser, so any user can bypass it. The server must enforce it.

### 5.1 Normalization on every load and save: `normalizeStudentLevel` ([lib/storage.ts:170](lib/storage.ts#L170))
- An invalid `level` becomes `Level 0`.
- Topic and step whitespace are cleaned, and `"1.0 Introduction"` becomes `"Introduction"`.
- `instructor` is converted to its canonical name (§6.1).
- Legacy fixes (§7).
- ⚠️ **Known bug:** Level 0 students always have their step and topic forced to `Introduction`, so Level 0 progress is lost on reload. **Don't copy this behaviour into the backend.**

### 5.2 Side effects of logging an interaction: `addInteractionLog` ([lib/storage.ts:236](lib/storage.ts#L236))
When an interaction is saved, the student's record is updated too:
- `interactionCount += 1`, and `lastInteractionDate = log.date`
- `status` is set to a free-text string based on `statusPostInteraction` and `interactionRound`:
  - Need to Revisit, round 1 → `Round 1 Revisit — needs retry on Level 0 basics`
  - Need to Revisit, round 2 or later → `Round 2 Revisit — needs retry before Level 1 promotion`
  - Cleared, round 2 or later → `Level 0 Cleared (Rounds 1 & 2 complete) — eligible for Level 1`
  - Cleared, round 1 → `Round 1 Cleared — eligible for Round 2`
  - Otherwise → `Interaction N In Progress`
- The UI filters and counts by **substring matching** on these strings (`status.includes('Cleared')` / `'Revisit'`).
- ⚠️ The wording mentions Level 0 even for students on Level 1–7. It's worth replacing with structured fields (for example `status_code` plus `round`) in the backend.
- The log insert and the student update should run in **one transaction**.

### 5.3 Who can see and edit what (currently enforced only by what the UI shows)
| | Admin | Instructor |
|---|---|---|
| All-students directory | read-only | read-only |
| "My Students" | all students, editable | only students where `isStudentAssignedTo(student, user)` is true, i.e. `student.instructorEmail === user.email` |
| Change level, topic or step | yes | assigned students only (should be enforced) |
| Log an interaction | yes | assigned students only (should be enforced) |
| Analytics | all students | all students |
| Interaction logs and CSV export | all | all (confirm whether this is intended) |

### 5.4 Analytics: `getInstructorSummaries` ([lib/storage.ts:265](lib/storage.ts#L265)) and `AnalyticsDashboard`
Per-instructor counts (assigned, completed, revisit, cleared, halls, levels), plus level and topic distribution. These can be computed in the browser from an API response at first. Move them to SQL aggregates if the payloads get large.

### 5.5 Parsing pasted rows ([lib/granolaParser.ts](lib/granolaParser.ts))
Pure text parsing. **It can stay in the browser.** Rule from context.jsx: fields from the pasted row always win over seed or transcript values.

### 5.6 CSV export ([lib/storage.ts:287](lib/storage.ts#L287))
It can stay in the browser, working on whatever data the API returns, or become a `GET /api/interactions/export` endpoint.

---

## 6. Data problems to fix during the migration

### 6.1 Instructor ↔ student mapping: now by company email (done on 2026-09-27)
**Before:** students were linked to instructors by short name (`"Gaurav - 25"`, `"Adarsh"`) with loose substring matching, so an account named `Gaurav` saw both Gaurav cohorts.

**Now:**
- [lib/data/instructors.json](lib/data/instructors.json) is the directory. Each entry has a full `name`, a company `email`, and `aliases` (the short names used in `students.json`).
- `matchInstructor(name, email?)` ([lib/instructorDirectory.ts](lib/instructorDirectory.ts)) is shared by the app and the DB seed. It tries these in order:
  1. **Email**, which is unique.
  2. **Exact full name or alias** (for example, `Gaurav - 25` resolves to INS010).
  3. **First name.** If exactly one instructor has that first name, it's a match. If **several** do, the result is `ambiguous` with the candidates listed, and **no instructor is assigned**. If none do, the result is `unmatched`.

  Names are normalized first (lower-cased; dots and `sir/mr/mrs/ms/admin` removed). Partial-name matching is never used.
- When a student is loaded, `normalizeStudentLevel` sets `instructor` to the **first name** (for display) and fills in `instructorEmail`, `instructorId`, `instructorFullName` and `instructorMatch`.
- The Instructor List (`getInstructorSummaries`, and the Analytics page's instructor table) groups students by **email** and shows the **full name**. Analytics counts each instructor's interactions by resolving the "taken by" name or email, not by partial names.
- Tested: a bare `Gaurav` or `Gaurav Kumar` is `ambiguous` (2 candidates). `Gaurav - 25` resolves to INS010. `Gaurav` together with the email gaurav.k@ resolves to INS011.
- If `Ashutosh Singh` is ever added to the directory, a bare `Ashutosh` becomes `ambiguous` and gets flagged. That is the intended safety behaviour.
- `isStudentAssignedTo(student, user)` compares **emails**. It compares exact names only when either side has no email.
- `instructorNamesMatch` is now an exact match (substring matching removed).
- **Registration** accepts only emails listed in the directory. The account name is taken from the directory, not from what the user types, so accounts always match their students.
- The localStorage keys for accounts and the current user moved to `_v3`, so old accounts with non-company emails are dropped and people must register again.

**Mapping result for `students.json`:** all 892 students map to 30 instructors.

| Seed name | Directory name |
|---|---|
| Adarsh | Adarsh Mishra |
| Akarsh | Akarsh Jain |
| Akash | Akash Kumar Karn |
| Ashish | Ashish Kumar Singh |
| Ashutosh | Ashutosh Rana |
| Aviskar | Aviskar Yadav |
| Ayaan | Ayaan Khan |
| Balasaheb | Balasaheb Lokre |
| Deep Sharma | Deep Sharma |
| Gaurav - 25 | Gaurav Kumar (Gaurav 25) |
| Gaurav - 26 | Gaurav Kumar (Gaurav 26) |
| Gyanendra | Gyanendra Mani |
| Jai Kishan | Jai Kishan |
| Kaif Nazir | Mohammad Kaif Nazir |
| Keshav | Keshav Soni |
| Khushal | Khushal Yadav |
| Lakshay | Lakshay Singh |
| Nitesh | Nitesh Kumar Kumawat |
| Paras | Paras Mer |
| Piyush | Piyush Sharma |
| Ranith | Ranit Ray |
| Rohith | Vallepu Rohith |
| Sanuth | Mettu Sai Sanuth Reddy |
| Shivam | Shivam Kumar |
| Shubham | Shubham Sharma |
| Sreeram | Sreeram Reddy Gongal |
| SUDHANVA | Sudhanva B R |
| Sumeet | Sumeet Sharma |
| Umesh | Umesh |
| Vaibhav | Vaibhav Verma |

**Notes:**
- `Ranith` (8 students) was added with email [email in instructors.json], provided separately from the sheet. The full name "Ranit Ray" was inferred from the email.
- The source sheet also lists `Ashutosh Singh` (ashutosh.singh@). The seed name `Ashutosh` is **Ashutosh Rana** (confirmed by the team on 2026-09-27).
- Instructors in the sheet with no assigned students were left out on purpose: Jasvinder Chaudhary, Aniket Jaiswal, Ashutosh Singh, Maddipati Deshith Sai, Vikash Kumar Gautam, Ayush Kumar, Santoon Kumar Panda, Aayush Sharma, Thoma Varkala.
- Phone numbers from the sheet are not stored (the app doesn't use them).
- **Backend recommendation:** import `instructors.json` into `users`, then set `students.instructor_id` by looking up each seed name with the same exact alias match. Drop the name-based fallback once every student has an instructor id.

### 6.2 Passwords and sessions are not secure
- `simpleHash` is a 32-bit djb2 hash, which is not a password hash. Default passwords are in the source code.
- The full user object, **including `passwordHash`**, is stored in localStorage.
- The session cookie is an unsigned user id, and `proxy.ts` only checks that it exists.
- Registration is now limited to directory emails, but there's no email verification. Anyone who knows an instructor's company email can register as them if that instructor hasn't registered yet.
- **Backend recommendation:** use bcrypt or argon2 for passwords, a signed httpOnly session cookie or a proper auth provider, and role checks on every API route. Decide who is allowed to create instructor accounts.

### 6.3 Existing browser data
Because the data lives separately in each browser (§1), there is no single current dataset. Decide on one of these:
- **(a)** Start the DB from `students.json` and accept that local edits are lost, or
- **(b)** Build a one-time "Upload my local data" action that sends each browser's `kkh_dsa_interactions_v2` to the server, deduplicated by `id`.

---

## 7. Changes made so far (changelog)

### 2026-09-27
1. **Recursion split into two topics.** It used to appear as `Recursion` in both Level 2 and Level 5.
   - Level 2 → `Recursion - Basics`; Level 5 → `Recursion - Advanced`.
   - Updated in `storage.ts` (default topic map), `StudentRosterTable.tsx` (level topic map, step overrides, topic filter) and `AnalyticsDashboard.tsx` (topic list plus regex: "advanced" → Advanced, otherwise → Basics).
   - **Migration of old data:** `normalizeRecursionTopic` ([lib/storage.ts:133](lib/storage.ts#L133)) rewrites a stored `Recursion` to `Recursion - Advanced` for Level 5 students and `Recursion - Basics` for everyone else. **The backend import must apply the same rule.**
   - Past `InteractionLog.topics` text is unchanged (it's historical).
2. **One spelling: "tweeked" → "tweaked"** in all step names (`2.2 easy - tweaked question`, `3.2 medium tweaked question`, `4.2 hard tweaked question`).
   - **Migration of old data:** `normalizeStepValue` ([lib/storage.ts:127](lib/storage.ts#L127)) replaces `tweeked` with `tweaked` in stored steps. **The backend import must apply the same rule.**
3. **The Level filter on the student table now lists Level 0 to Level 7.** It previously listed only 0–2. The options are generated the same way as the per-row Level dropdown.
4. **Instructors are now matched by company email** (details in §6.1).
   - New file `lib/data/instructors.json` (30 instructors; covers every student in `students.json`).
   - `storage.ts` gained `INSTRUCTOR_DIRECTORY`, `findDirectoryInstructor` and `isStudentAssignedTo`. `instructorNamesMatch` is now exact-match only. The 5 fake preset instructors were removed. Registration accepts directory emails only. Storage keys for accounts and the current user moved to `_v3`.
   - `StudentRosterTable` takes a new `currentInstructorEmail` prop and filters "My Students" by email. Search also matches instructor email.
   - `app/page.tsx` counts assigned students by email.
   - The seed `students.json` is unchanged. Names are converted to directory names and emails when loaded.
5. **Student List and Instructor List enrichment, and the PostgreSQL setup** (§1a).
   - `instructors.json` gained `id` and `firstName`. Aliases were reduced to spelling variants and batch labels.
   - New `lib/instructorDirectory.ts` (`matchInstructor`, with ambiguous detection). `storage.ts` re-exports it.
   - The student table shows the **first name**. The full name and email appear on hover, and an `ambiguous`/`unmatched` badge appears when matching fails. Search also covers full name and email.
   - Instructor summaries are grouped by email and show the full name.
   - New interactions record `level` and `currentStep` at log time, and `assignedInstructorName` stores the full name.
   - `lastInteractionDate` is only moved forward, so logging an older interaction later no longer overwrites a newer date.
   - Instructor accounts use the directory id (`INS0xx`) as the user id.
   - New `db/` folder, `npm run db:*` scripts, `.env.example`, and dependencies `pg`, `@types/pg`, `tsx`.
6. **Students and interactions now load from and save to PostgreSQL** (Neon database `neondb`). **Login is still in localStorage.**
   - API routes (all return 401 without the `kkh_auth_session` cookie):
     - `GET /api/students`
     - `PATCH /api/students/[id]` with `{ level?, currentTopic?, currentStep? }`, validated against the curriculum. A level change resets topic and step to that level's defaults.
     - `GET /api/interactions`
     - `POST /api/interactions` (inserts the log and updates the student's status in one transaction)
   - [app/page.tsx](app/page.tsx) loads students and interactions from the API. A level, topic or step change on "My Students" appears immediately (on that page and in the directory), is saved to the DB, and is rolled back with an error message if saving fails.
   - All 892 students start at Level 0, as in the sheet. Re-running `db:seed` does **not** reset progress.
   - The curriculum now lives in one place, [lib/multiLevelCurriculum.ts](lib/multiLevelCurriculum.ts), used by the table, `storage.ts` and the API. The "5 copies" issue (§2.4) is resolved for the app; `context.jsx` is still a separate documentation copy.
   - **Fixed:** Level 0 topic and step changes now persist (the DB path doesn't use the old reset logic). A topic change now fixes an invalid step.
   - The rule for a student's status after an interaction is now `statusAfterInteraction()` in `storage.ts`, shared with the API.
7. **The app reads data from the DB only.**
   - `db:seed` replaces topics that aren't valid for the level with the level's default topic.
   - The student/interaction localStorage code (`getStoredStudents`, `saveStudents`, `getStoredInteractions`, `saveInteractions`, `addInteractionLog`) and the JSON imports in `storage.ts` were **removed**. The browser app no longer reads `students.json` or `initialInteractions.json`; only `db/seed.ts` does.
   - Analytics topic counts use `ALL_TOPICS` from the curriculum with exact matching (the old regex clean-up is gone). "Progressed" now means beyond Level 0, or past Introduction (topic or step) within Level 0.
8. **Level 0 dropdowns and Gaurav display names.**
   - **Level 0:** the Topic and Step dropdowns both offer the same 7 items (Introduction … Pattern Questions). **Levels 1–7:** Topic lists that level's topics, and Step lists 1.1 → 3.2 (Level 1 topics) or 1.1 → 4.2 (Levels 2–7).
   - In the DB, all 892 students are `Level 0 | Introduction | Introduction`. A short-lived "Level 0" topic value was reverted. The `current_topic` default is `'Introduction'`.
   - The two Gauravs now show as **Gaurav-25** (INS010, Hall 10, 38 students) and **Gaurav-26** (INS011, Hall 6, 37 students) in the Student List, instead of the same "Gaurav". Their full names stay `Gaurav Kumar (Gaurav 25/26)` in the Instructor List. `Gaurav-25`/`Gaurav-26` were added as aliases, so typing them resolves to the right instructor. A bare "Gaurav" is still flagged ambiguous.

9. **Database-backed login and permissions** (replaces the localStorage login; §6.2 is resolved).
   - **No registration.** Accounts come only from `db/users.local.csv` (git-ignored; template `db/users.example.csv`), loaded with `npm run db:users`. That file is the **complete list** of people who can sign in: accounts not in it are deleted, and every run signs everyone out. Instructor rows must use a directory email (the name comes from the directory); admin rows need `role=admin` and a name. At least one admin is required.
   - Passwords are hashed with scrypt and a per-user salt. Sessions are random tokens in an **httpOnly** cookie `kkh_session` (12 hours, fixed; not extended by activity). Only a SHA-256 hash of the token is stored, in the `sessions` table.
   - Routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. The error for a wrong password and an unknown email is the same.
   - **Permissions, enforced on the server:**
     | | Admin | Instructor |
     |---|---|---|
     | Directory (all students), Analytics, Logs | read | read |
     | Instructors page (`GET /api/instructors`) | read | 403 |
     | Assigned page | — | own students only |
     | Change level/topic/step, log an interaction | 403 | **own assigned students only** (403 otherwise) |
   - Removed: the Register tab, the demo credentials, and every browser-side account/session function in `storage.ts`.
   - Tested with temporary accounts (since deleted): wrong password, unknown email, forged cookie, admin edit, instructor editing another instructor's student, instructor editing own student, logout.

10. **The Log Interaction form no longer has the Google Sheet Row Extractor.**
    - Removed: the paste box, "Load Sample Row", and the sample transcript. `lib/granolaParser.ts` is now unused, and `granolaTranscript` is saved as `''`. The pasted-row rules in `context.jsx` no longer apply.
    - **Student Name** and **Assigned Instructor** (full name) are filled in from the selected student and are read-only.
    - **Date** defaults to today in local time (not UTC), and the instructor can change it.
    - The modal is mounted only while a student is selected, so each open starts with fresh fields. This replaced two state-reset effects.

11. **No more "rounds", and a neutral look for the history popup.**
    - Student status is now round-free: `Pending Evaluation`, `Needs Revisit`, `Cleared` or `In Progress` (`statusAfterInteraction()` in `storage.ts`). The 892 existing statuses were rewritten with the counts unchanged, and the DB default is now `'Pending Evaluation'`.
    - Removed: the "Round N" badge and the "Level 0 requires 2 validated interactions" note in the history popup, and "(Round N)" in the Log Interaction header. `interactions.interaction_round` is still stored (always 1) but never shown. `components/InteractionRoom.tsx` still has round buttons, but nothing uses it.
    - `StudentHistoryModal` has no cyan/purple/gradients; status is a neutral badge with a small coloured dot. It also shows Improvement areas now.
12. **The history popup is now a numbered timeline.** Entries are labelled **Interaction 1, 2, …** in the order they happened (oldest = 1). They're sorted newest first, by date then `createdAt`, and the top one is tagged "Latest". The panel uses a fixed **dimmed-grey** palette (surfaces `#1c2128`/`#22272e`/`#2d333b`, borders `#373e47`, text `#cdd9e5`/`#adbac7`). This replaced an all-white version that was too bright for long review sessions, and it stays distinct from the near-black dashboard. It has a summary strip (current level, number of interactions, last interaction, average rating) and a timeline rail with numbered markers.

13. **The Logs page is now "Today's Interactions" and shows today only.** The list is filtered in `app/page.tsx` (`todaysLogs`): a log appears only if its interaction `date` is today. (Changed 2026-09-29: it used to also include anything logged today via `createdAt`, so back-dated logs showed up. Now an interaction taken yesterday but logged today appears only in the student's history.) Everyone (admins and instructors) sees **every instructor's** interactions from today. The Logs tab count and "Export Today (CSV)" use the same list; the navbar Export still exports everything. Student history and Analytics are unchanged. The new `lib/dates.ts` (`todayLocal`, `localDateOf`) is shared with the Log Interaction form.

14. **Status is now per level, with a level overview on the Directory and Assigned pages.**
    - `student_overview.level_status` is the student's standing at their **current level**: the latest interaction whose `level` equals the student's level, where a `NULL` level counts as Level 0. It maps to `Pending Evaluation` (no interaction at this level), `In Progress`, `Needs Revisit` or `Cleared`. `level_interaction_count` is also exposed. The API's `Student.status` now comes from this, so a promoted student is automatically **pending again** until evaluated at the new level. The stored `students.status` column is no longer read.
    - The new `components/LevelOverview.tsx` is a Level 0–7 × status matrix. Every number filters the student table.
    - `StudentRosterTable`: summary cards are now Total / Not interacted yet / In Progress / Needs Revisit / Cleared, and each is clickable. "Level 0 Target" was removed. The status filter uses the same four statuses, and there's a new **Status** column.
    - The Directory computes this over all students (visible to everyone); the Assigned page computes it over the instructor's own students.

15. **`initialInteractions.json` is reference only and is ignored.** `db/seed.ts` no longer imports any interactions. The previously imported sample row (`int-seed-1`, Pamu Harshavardhan, 2026-09-24) was deleted, so Pamu is back to Pending Evaluation. Interactions now come **only** from instructors logging them in the app.

16. **Analytics gets a "Daily overview by college".** `components/DailyCollegeOverview.tsx` sits above College-wise Analytics.
    - One row per day. For each college (taken from `students.degree`: BITS, CDU) and a Total, it shows Students, Cleared, Revisit and In progress.
    - A student with several interactions on one day counts once, with their **latest** outcome that day.
    - Ranges: 7, 14 or 30 days (every day shown, zeros included) or All time (only days with interactions). Today's row is highlighted, and there's a "Period total" footer.
    - Instructors get an **All students / My students** switch (by `instructorId`).
    - Everything is computed in the browser from `/api/students` and `/api/interactions`.

17. **Analytics clean-up.**
    - Removed the top card row: Total Enrolled Cohort, Level 0 Target Size, Level 0 Completion and Avg Candidate Score, plus their calculations.
    - Removed the per-student name list inside the CDU and BITS College-wise panels. Their four totals (Total Interactions, Today, Cleared, Revisit) remain.
    - Analytics' "today" now uses the local date (`todayLocal`) instead of the UTC date.

18. **The deployed app needs no data files.**
    - `lib/instructorDirectory.ts` is now pure: `matchInstructor(directory, name, email)` takes the list as an argument. The server loads it from the `instructors` table (`loadDirectory` in `db/queries.ts`).
    - Interactions expose `takenByInstructorId`, and Analytics matches instructors by that id instead of by name.
    - `db/seed.ts` reads `lib/data/instructors.json` and `lib/data/students.json` with `readFileSync` at run time, so they are needed only on the machine that runs the one-time import.
    - Verified: `tsc` and `next build` both pass with those two files removed.
    - Deployment needs only `DATABASE_URL`, plus a database that already has the tables and data (`npm run db:setup` and `npm run db:users`, run once from a machine that has the files).

19. **"Interaction Taken By" is a searchable instructor dropdown.**
    - `components/InstructorPicker.tsx` offers search, ↑/↓, Enter and Esc. It defaults to the signed-in instructor, and only listed instructors can be chosen, with no free text.
    - The choice is saved as `takenByInstructorId`. The server checks the id against the `instructors` table and falls back to name/email matching only for older clients.
    - The list comes from the new `GET /api/instructors/options` (id, full name, first name; any signed-in user). `GET /api/instructors` stays admin-only because it includes students.
    - The save button now reads "Save Interaction".
    - Tested: a Gaurav-26 login recording a session taken by Gaurav-25 was stored as INS010. The test row was deleted.

20. **Sign-in lasts 12 hours** (`SESSION_MAX_AGE_SECONDS` in `lib/sessionCookie.ts`). It's fixed and not extended by activity. Sessions that already existed were capped to 12 hours from when they were created.
21. **Admins can add instructors in the app.** Instructors page → "Add instructor" (`components/AddInstructorForm.tsx`, `POST /api/instructors`, admin only).
    - Fields: full name, Student List name (must be unique), email/login, password (at least 8 characters), and roll numbers (pasted separated by commas, spaces or new lines).
    - A live preview shows how many students will be assigned and from whom.
    - One transaction (`createInstructor` in `db/queries.ts`) does it all: create the instructor with the next `INS###` id, create a hashed login, and move the listed students to them. Each student leaves their previous instructor, so every count updates. It is rejected with nothing changed if the email is taken, the display name is taken, a roll number is unknown, or the password is too short.
    - **Instructors created in the app exist only in the DB**, not in `instructors.json`.
    - Safety changes to the scripts:
      - `db:seed` no longer overwrites an existing matched assignment; it only fills unmatched students.
      - `db:users` no longer deletes accounts missing from the CSV. Use `npm run db:users -- --prune` to delete them deliberately.
    - Tested end to end with a temporary instructor, since removed: validations, a 403 for non-admins, counts 37→35 / 0→2, the new login seeing and editing its students, and the old instructor being blocked from the moved students.
    - Only existing roll numbers can be assigned. Adding brand-new students is a separate, future feature.

22. **Logged interactions can be edited.**
    - Route: `PATCH /api/interactions/[id]` (`updateInteraction` in `db/queries.ts`).
    - Allowed for the student's **assigned instructor** or the **person who logged it** (`created_by`). Admins get 403.
    - Editable: date, taken by, topics, status, rating and every text field. Fixed: the student, the level/step snapshot and the creation time.
    - Same validation as creating, via the shared `validateInteractionFields`: date format, no future dates, rating 0–5, known status, and a taken-by that exists in `instructors`.
    - New columns: `interactions.updated_at` and `updated_by`, exposed as `updatedAt`; `createdBy` is exposed too. An "edited" tag appears in the table and the history popup.
    - Where to edit: **Inspect → Edit interaction** on Today's Interactions, or **Edit** on each entry in a student's history. Both open the same form (`PostInteractionModal` with `editing`), pre-filled.
    - Because student status is derived, an edited status updates the student and every count immediately.
23. **Today's Interactions** now has separate **Assigned Instructor** and **Taken By** columns. **Inspect** shows every field: assigned / taken by, date, status, rating, level and step when logged, topics, questions, remarks, performed well, improvement areas, tweaked questions, action items and the meet recording. Empty ones show "Not filled".
24. **Topics in the interaction form is a multi-select dropdown** (`components/TopicMultiPicker.tsx`), not free text.
    - It lists that level's topics from `getTopicOptions` (the student's current level for a new log, the logged level when editing). It's searchable, at least one topic is required, and selected topics show as removable chips.
    - Still stored as one string, joined with `", "` (e.g. `Data Types, Loops`), so there's no DB, API or CSV change. When editing an older free-text log, its text is split on commas and kept as chips.
25. **Duplicate STL topic removed from Level 1.** `STL - Introduction` and `STL - Standard Template Library` were the same topic; they are now one topic named `STL`. Checked on 2026-09-29: no student or interaction used either value, so no data migration was needed.
26. **Interactions can be deleted, with a required reason** (2026-10-01).
    - Route: `DELETE /api/interactions/[id]` with `{ reason }` (`deleteInteraction` in `db/queries.ts`). Same permission as editing: the student's assigned instructor or whoever logged it; admins get 403. The reason must be 5–1000 characters.
    - The row is **moved** to the new table `deleted_interactions` (`id`, `student_id`, `data` = full row as JSONB, `delete_reason`, `deleted_by` = user id, `deleted_at`) in one transaction. Every query, count and status reads `interactions`, so nothing else needed a filter, and older deployed builds also stop showing it.
    - **Restoring** a mistaken delete: `INSERT INTO interactions SELECT * FROM jsonb_populate_record(NULL::interactions, (SELECT data FROM deleted_interactions WHERE id = '<id>'));` then `DELETE FROM deleted_interactions WHERE id = '<id>';`
    - UI: **Delete** next to **Edit** in a student's history, and **Delete interaction** in Today's Interactions → Inspect. A dialog (`components/DeleteInteractionDialog.tsx`) asks "Delete this interaction?" and the reason; on success the log disappears and the student's status is recalculated.

### Known open issues (not yet fixed)
- There's no limit on repeated failed login attempts yet.
- Instructors can still read the full Directory, Analytics and Logs (the earlier rule). Hide these if instructors should see only their own students.
- In `AnalyticsDashboard.normalizeTopic`, `Time & Space Complexity analysis` and `Pattern Questions` are mapped to `Traversal` ([components/AnalyticsDashboard.tsx:130-131](components/AnalyticsDashboard.tsx#L130-L131)), and neither topic is in `topicList`, so they are missing from the topic counts.

---

## 8. Proposed backend shape (for discussion, not decided)

### 8.1 Tables
```
users         (id PK, name, email UNIQUE, role, hall, password_hash, created_at)
students      (id PK /* roll no */, name, degree, section, hall,
               instructor_id FK→users.id NULL,
               level SMALLINT 0-7, current_topic, current_step,
               status_code, status_round, updated_at, updated_by FK→users.id)
interactions  (id PK, student_id FK→students.id,
               taken_by_name, taken_by_email, taken_by_user_id FK→users.id NULL,
               assigned_instructor_name /* snapshot */, student_name /* snapshot */,
               topics, status_post_interaction, rating, questions_asked, remarks,
               performed_well, improvement_areas, tweaked_questions, action_items,
               meet_recording, granola_transcript, interaction_round,
               date, created_at, created_by FK→users.id)
curriculum_*  (optional: levels / topics / steps, if admins must edit the curriculum)
```
`interactionCount` and `lastInteractionDate` can be computed from `interactions` instead of being stored.

### 8.2 API that replaces each `storage.ts` function
| Today (`lib/storage.ts`) | Proposed endpoint |
|---|---|
| `authenticateWithEmail` + `saveStoredCurrentUser` | `POST /api/auth/login` (sets a signed httpOnly cookie) |
| `registerInstructor` | `POST /api/auth/register` (restrict to admins?) |
| `getStoredCurrentUser` | `GET /api/auth/me` |
| `clearStoredInstructorSession` | `POST /api/auth/logout` |
| `getStoredStudents` | `GET /api/students` (instructors may be scoped to their own students, but the directory and analytics need all) |
| `saveStudents` (level, topic and step edits in `app/page.tsx`) | `PATCH /api/students/:id` with `{ level?, currentTopic?, currentStep? }`, validated against the curriculum |
| `getStoredInteractions` | `GET /api/interactions?studentId=` |
| `addInteractionLog` | `POST /api/interactions` (inserts the log and updates the student in one transaction) |
| `getRegisteredInstructors` / `getInstructorSummaries` | `GET /api/instructors`, `GET /api/analytics/instructors` |
| `exportInteractionsToCSV` | Keep in the browser, or `GET /api/interactions/export` |

Note that `saveStudents` currently rewrites **the whole array** on every dropdown change. The API should update one student at a time.

### 8.3 Suggested order of work
1. Move the curriculum into `lib/multiLevelCurriculum.ts` so the server and the browser share a single source.
2. Decide the open questions in §9.
3. Set up the DB schema and an import script (`instructors.json` → users; `students.json` → students with `instructor_id` looked up by alias; apply the §7 legacy rules; fix the Level 0 reset behaviour).
4. Auth endpoints, then replace the login page and `proxy.ts` checks.
5. Student and interaction endpoints; make `app/page.tsx` load from the API instead of `getStoredStudents()` / `getStoredInteractions()`.
6. Enforce roles on the server (§5.3).
7. Remove the localStorage persistence (keep `kkh_theme`).

**Framework note:** this project uses **Next.js 16.3.6**, which has breaking changes compared with older versions (see [AGENTS.md](AGENTS.md)). Read `node_modules/next/dist/docs/` before writing route handlers, the proxy or server actions. For example, `middleware.ts` is now `proxy.ts`.

---

## 9. Open decisions for the team
- ~~Backend technology~~: **decided**. PostgreSQL (`kkh_dsa_analytics`) with `pg`, accessed from Next.js route handlers (§1a).
- **Authentication:** our own email/password, or Google sign-in restricted to the organisation's domain?
- **Who can create instructor accounts,** and who can reassign students?
- **What to do with existing localStorage data** (§6.3 (a) or (b))?
- **Should instructors see all interaction logs** and export them, or only their own?
- **Should the curriculum be editable by admins** (stored in the DB) or stay in code?
