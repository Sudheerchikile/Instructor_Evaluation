const projectContext = {
  projectName: 'KKH DSA Analytics',
  stack: {
    framework: 'Next.js 16.3.6',
    language: 'TypeScript + React',
    state: 'Client-side localStorage storage with seeded JSON data',
    routing: 'App Router'
  },

  goal: {
    summary:
      'A role-based DSA student tracking and analytics dashboard for managers and instructors. It supports student directory views, assigned-student filtering, interaction logging, student progress tracking, and analytics summaries.',
    primaryUsers: ['Admin / Manager', 'Instructor'],
    businessFlow:
      'Instructors log interactions, managers review all students and analytics, and each instructor can view only assigned students in their dashboard but still access analytics across all students.'
  },

  importantBusinessRules: [
    'All students start at Level 0.',
    'A student crosses Level 1 only if they clear all subtopics of level 0 like introduction ,data types,if else ,loops ,traversal,time and space complexity analysis ,patterns of  Level 0.',
    'Level selection is a dropdown from Level 0 to Level 7.',
    'Each level has a default topic and current step set.',
    'Student list must show all students with assigned instructor, current level, degree/section, and exam hall.',
    'Instructor home page should show only assigned students, but analytics should include all students.',
    'Managers should see full student directory and summary analytics.',
    'The app uses Ashutosh Rana as canonical instructor naming for Ashutosh alias variations.'
  ],

  currentState: {
    roles: {
      admin: 'Full directory + manager analytics + assigned cohort view',
      instructor: 'Assigned-student view + own analytics + ability to log interactions for assigned students'
    },
    homePage: {
      allStudents: 'Full manager dashboard with student details and assignment overview',
      myStudents: 'Assigned-student view restricted to current instructor',
      analytics: 'Aggregated metrics and instructor summaries',
      logs: 'Interaction log table'
    },
    levelSystem: {
      defaultLevel: 'Level 0',
      topicField: 'Current topic shown beside the level dropdown',
      sameTopicReflectedInDirectoryAndAssignedViews: true,
      defaultProgress: {
        'Level 0': ['Introduction', 'Data Types', 'If else', 'Loops', 'Traversal', 'Time & Space Complexity analysis', 'Pattern Questions'],
        'Level 1': ['1.1 Concept & Prerequisites', '1.2 Complexity & Reasoning', '1.3 Concept Explanation + own testCase / Example', '2.1 easy - standard question', '2.2 easy - tweaked question', '3.1 medium standard question', '3.2 medium tweaked question', '4.1 hard standard question', '4.2 hard tweaked question']
      }
    },
    interactionFlow: {
      modalName: 'PostInteractionModal',
      requirement: 'When logging interaction for a student, student name and assigned instructor should be prefilled automatically.',
      pastedRowBehavior: 'The pasted Google Sheet row should populate the remaining interaction fields, while student and assigned instructor remain fixed unless changed manually.',
      fieldsFromRow: [
        'Date',
        'Topics',
        'Status Post Interaction',
        'Rating',
        'Questions Asked During Interaction',
        'Remarks by Instructor',
        'Performed Well',
        'Improvement Areas',
        'Tweaked Questions Asked',
        'Action Items',
        'Meet Recording'
      ],
      interactionTakenBy: 'Should be editable and may be filled from the pasted row or manually typed.'
    }
  },

  implementedFeatures: [
    'Student roster directory with search and filter support',
    'Instructor assignment visibility in directory and assigned views',
    'Current level, current topic, and step dropdown editing',
    'Manager analytics dashboard with summaries and instructor metrics',
    'Interaction logging modal with a pasted-row extractor',
    'CSV export of interactions',
    'Role-based login flow for admin/instructors',
    'localStorage persistence for students, interactions, and current user',
    'Seeded JSON student and interaction data with normalization',
    'Canonical instructor name normalization to Ashutosh Rana',
    'Student defaulting logic for Level 0 and topic/step progression'
  ],

  keyFiles: {
    appPage: 'app/page.tsx',
    studentRoster: 'components/StudentRosterTable.tsx',
    postInteractionModal: 'components/PostInteractionModal.tsx',
    analyticsDashboard: 'components/AnalyticsDashboard.tsx',
    interactionLogsTable: 'components/InteractionLogsTable.tsx',
    storageLogic: 'lib/storage.ts',
    parser: 'lib/granolaParser.ts',
    types: 'lib/types.ts',
    seededStudents: 'lib/data/students.json',
    referenceOnlyInteractions: 'lib/data/initialInteractions.json (reference only; do NOT import or use)'
  },

  dataModel: {
    Student: {
      id: 'student id',
      name: 'student display name',
      level: 'Level 0 to Level 7',
      currentStep: 'current step in selected level',
      currentTopic: 'current topic in selected level',
      instructor: 'assigned instructor name',
      degree: 'degree information',
      section: 'section information',
      hall: 'exam hall',
      status: 'optional status'
    },
    InteractionLog: {
      id: 'interaction id',
      studentId: 'linked student id',
      studentName: 'student name snapshot',
      instructorName: 'interaction taken by',
      assignedInstructorName: 'assigned instructor at time of log',
      topics: 'topic string',
      statusPostInteraction: 'Need to Revisit | Cleared | In Progress',
      rating: 'numeric rating (0-5)',
      questionsAsked: 'free text or list',
      remarks: 'remarks field',
      performedWell: 'performed-well field',
      improvementAreas: 'improvement field',
      tweakedQuestions: 'tweaked questions field',
      actionItems: 'action items field',
      meetRecording: 'recording link',
      granolaTranscript: 'raw pasted text',
      interactionRound: 'round number',
      date: 'interaction date',
      createdAt: 'timestamp'
    }
  },

  parserLogic: {
    intent:
      'Parse pasted Google Sheet rows copied from instructor sheets and extract structured values into the modal form without depending on transcript text or stale seeded interaction data.',
    importantRule:
      'Freshly pasted row content must override transcript/seed fallback values.',
    recognizedPatterns: [
      'Tab-delimited row',
      'Quoted multi-line question blocks',
      'Google sheet row with fields like Date, Instructor Name, Topics, Status, Rating, Questions, Remarks, Improvement, Action Items',
      'URL meet recording at end'
    ],
    knownIssuesResolved: [
      'Transcript field removed from user-facing UI when not needed',
      'Initial interactions JSON no longer overwrites new row data',
      'Field extraction aligned to copied row format instead of legacy transcript sample',
      'Sectionless or stale values normalized to canonical names and Level 0 topics'
    ]
  },

  currentKnownBehavior: {
    studentNames: 'Auto-filled when opening Log Interaction for a chosen student',
    assignedInstructor: 'Auto-filled based on student.instructor',
    interactionTakenBy: 'Not auto-filled by current user; can be extracted from pasted row or typed manually',
    rowExtraction: 'Should fill all other fields; no transcript-based fallback should dominate when a row is pasted',
    managerDashboard: 'Shows all students and their detail table',
    instructorDashboard: 'Shows only assigned students',
    analytics: 'Used for manager-level review and progress metrics'
  },

  knownConstraints: [
    'The app is client-side only for the demo; no backend or DB is used.',
    'Data persists in localStorage instead of a server.',
    'The project folder must be launched from the actual repo directory, not the parent folder.',
    'The project was initially affected by path issues when running npm commands from the wrong folder.',
    'The app must remain build-safe after parser and modal changes.'
  ],

  recentFixesDelivered: [
    'Student and assigned instructor auto-fill when logging an interaction',
    'Pasted Google Sheet row extract fills the rest of the form',
    'No transcript field required in the visible UI',
    'Extraction prioritizes the dynamic row over stale seed content',
    'Level 0 and default step/topic values normalized',
    'Instructor naming normalized and matched across Ashutosh/Ashutosh variants',
    'Project builds successfully after major logic updates',
    'Recursion split into "Recursion - Basics" (Level 2) and "Recursion - Advanced" (Level 5); legacy "Recursion" migrated by level',
    'Step spelling unified to "tweaked" (legacy "tweeked" migrated on load)',
    'Level filter in the student table covers Level 0 to Level 7'
  ],

  backendMigration: 'See BACKEND_MIGRATION.md for the localStorage inventory, business rules to move server-side, changelog, and proposed schema/API.',

  importantRemindersForFutureClaudeWork: [
    'Do not overwrite pasted row values with stale seeded JSON values.',
    'When the user opens Log Interaction for a student, keep the selected student values as the base fields.',
    'Respect admin vs instructor role rules and visibility behavior.',
    'Keep all logic client-side and localStorage-based unless explicitly told otherwise.',
    'When parsing pasted row data, prefer sheet-row patterns first, transcript parsing second, and manual entry as fallback.',
    'If the user asks for exact row-based parsing, tune the parser around the real clipboard format, not the earlier transcript sample.'
  ]
};

export default projectContext;
