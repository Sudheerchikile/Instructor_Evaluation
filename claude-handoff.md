# Claude Handoff: KKH DSA Analytics

You are continuing work on the KKH DSA Analytics app in this repo.

## Project overview
This is a Next.js + TypeScript app for a DSA student tracking dashboard used by managers and instructors. It stores data in localStorage and uses seeded JSON for the demo. The app supports:

- role-based login for admin and instructors
- student roster and assigned-student view
- manager dashboard and analytics view
- interaction logging modal
- interaction extraction from pasted Google Sheet rows
- CSV export of interactions

## Core business rules
- All students start at Level 0.
- A student crosses Level 1 only if they clear both round 1 and round 2 of Level 0.
- There is a level dropdown from Level 0 to Level 7.
- Each level has a current topic and current step/default step selection.
- For the assigned view, only the current instructor's assigned students should appear.
- For analytics, the system should include all students for manager review.
- The full roster should show student details including assigned instructor, current level, degree, section, and exam hall.
- Instructor names are normalized to Ashutosh Rana when needed.

## Important implementation details
- Use localStorage persistence; no backend is required for the demo.
- Main dashboard logic is in app/page.tsx.
- Student roster is in components/StudentRosterTable.tsx.
- Interaction modal is in components/PostInteractionModal.tsx.
- Analytics is in components/AnalyticsDashboard.tsx.
- Storage logic is in lib/storage.ts.
- Parser logic is in lib/granolaParser.ts.
- Shared types are in lib/types.ts.

## Interaction logging behavior
When opening Log Interaction for a student:
- Student Name should be prefilled auto.
- Assigned Instructor should be prefilled auto.
- Interaction Taken By should not be auto-filled from the current user.
- The pasted Google Sheet row should fill the rest of the fields.
- If the row is not pasted, the instructor may fill the remaining values manually.

## Row extraction priority
When a pasted row is present:
- the pasted row should be treated as the source of truth
- stale initialInteractions.json or transcript-style fallback data should not overwrite it
- extracted fields should include: date, topic, status, rating, questions asked, remarks, performed well, improvement areas, tweaked questions, action items, and meet recording

## Current status
The app has already built successfully after the recent fixes. The main remaining behavior is exact row parsing and keeping the base student/instructor fields locked while the pasted row fills the interaction fields.

## File to read for context
- context.jsx
- lib/granolaParser.ts
- components/PostInteractionModal.tsx
- app/page.tsx
- lib/storage.ts

## Key reminder
Do not overwrite the selected student or assigned instructor values with pasted row data. The pasted row should only populate the remaining interaction fields unless the user explicitly chooses to change the other values manually.
