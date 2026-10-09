// Single source for levels -> topics -> subtopics -> steps. Used by the student table dropdowns and by the API to validate updates.

export const LEVELS = Array.from({ length: 8 }, (_, index) => `Level ${index}`);

// Level 0: topic and step dropdowns offer the same subtopics. Every student starts at Level 0 / Introduction / Introduction.
const LEVEL_0_ITEMS = ['Introduction', 'Data Types', 'If else', 'Loops', 'Traversal', 'Time & Space Complexity analysis', 'Pattern Questions'];

const STEPS_UP_TO_MEDIUM = [
  '1.1 Concept & Prerequisites',
  '1.2 Complexity & Reasoning',
  '1.3 Concept Explanation + own testCase / Example',
  '2.1 easy - standard question',
  '2.2 easy - tweaked question',
  '3.1 medium standard question',
  '3.2 medium tweaked question',
];

export const BASE_STEP_SEQUENCE = [...STEPS_UP_TO_MEDIUM, '4.1 hard standard question', '4.2 hard tweaked question'];

export const LEVEL_TOPIC_MAP: Record<string, string[]> = {
  'Level 0': LEVEL_0_ITEMS,
  'Level 1': ['Maths', 'STL', 'Array - Basics', 'Arrays', 'String'],
  'Level 2': ['Recursion - Basics', 'Sorting', 'Binary Search'],
  'Level 3': ['Two pointers / Sliding window', 'Greedy Algorithms'],
  'Level 4': ['Bit Manipulation', 'Stack & Queues', 'Stack - Monotonic Stack'],
  'Level 5': ['Heaps / PQ\'s', 'Linked list', 'Recursion - Advanced', 'AdHoc'],
  'Level 6': ['Dynamic Programming'],
  'Level 7': ['Binary Trees', 'Binary Search Trees', 'Graphs', 'Advanced Graph'],
};

export const ALL_TOPICS = Array.from(new Set(Object.values(LEVEL_TOPIC_MAP).flat()));

// Subtopics, in teaching order, keyed by "Level N|Topic". Each subtopic has its own run of steps, so changing the
// subtopic restarts the step. Topics not listed have no subtopics yet (the dropdown shows "—").
const SUBTOPIC_MAP: Record<string, string[]> = {
  'Level 1|Maths': ['LCM & GCD', 'Prime Numbers', 'Digit Manipulation', 'Fast Exponentiation'],
  'Level 1|STL': ['Set / Unordered Set', 'Map / Unordered Map', 'Stack and Queue'],
};

export function getSubtopicOptions(level: string, topic: string | undefined): string[] {
  return SUBTOPIC_MAP[`${level}|${(topic || '').trim()}`] ?? [];
}

// The subtopic to store for a topic: the given one when it belongs to the topic, else the topic's first
// subtopic, or null when the topic has none.
export function coerceSubtopic(level: string, topic: string, subtopic: string | null | undefined): string | null {
  const options = getSubtopicOptions(level, topic);
  if (!options.length) return null;
  return subtopic && options.includes(subtopic) ? subtopic : options[0];
}

// "Level 3" → "3", for narrow table columns.
export const levelShortLabel = (level: string) => level.replace(/^Level\s+/, '');

// Level 1 topics stop at medium questions.
const TOPICS_UP_TO_MEDIUM = new Set(LEVEL_TOPIC_MAP['Level 1']);

export function getTopicOptions(level: string): string[] {
  return LEVEL_TOPIC_MAP[level] ?? LEVEL_TOPIC_MAP['Level 0'];
}

export function getStepOptionsForTopic(level: string, topic: string | undefined): string[] {
  if (level === 'Level 0') return LEVEL_0_ITEMS;
  if (TOPICS_UP_TO_MEDIUM.has((topic || '').trim())) return STEPS_UP_TO_MEDIUM;
  return BASE_STEP_SEQUENCE;
}

export function getDefaultTopicForLevel(level: string): string {
  return getTopicOptions(level)[0];
}

export function getDefaultStepForLevel(level: string): string {
  return getStepOptionsForTopic(level, getDefaultTopicForLevel(level))[0];
}

// Keeps a step valid after the topic changes (e.g. a Level 2 "4.1 hard" step moved to a Level 1 topic).
export function coerceStep(level: string, topic: string, step: string | undefined): string {
  const options = getStepOptionsForTopic(level, topic);
  return step && options.includes(step) ? step : options[0];
}
