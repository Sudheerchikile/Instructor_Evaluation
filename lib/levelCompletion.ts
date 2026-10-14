import { LEVELS, getSubtopicOptions, getTopicOptions } from './multiLevelCurriculum';

// What a level conversion means (decided 2026-10-13). Applied in SQL in getLevelConversions (db/queries.ts).
//  - From STRICT_RULE_FROM: a student has converted from Level N once every required topic of Level N has its own
//    "Cleared" interaction logged at Level N; a topic with subtopics (lib/multiLevelCurriculum.ts) counts only once
//    every one of its subtopics has its own Cleared interaction (decided 2026-10-14). The conversion date is the
//    Cleared date of whichever topic or subtopic was cleared last (each one's first Cleared date; any order). A level
//    changed by hand before that is not counted.
//  - Everything tracked before STRICT_RULE_FROM is kept exactly as it was: those conversions count, dated by the
//    latest interaction at the old level before the promotion.
// Which rule applies depends on when the student first moved past the level, so correcting an old promotion later
// doesn't switch it to the new rule.
export const STRICT_RULE_FROM = '2026-10-13T16:00:00+05:30';

// Topics that never count towards completing a level.
const NOT_REQUIRED: Record<string, string[]> = { 'Level 0': ['Introduction', 'Data Types'] };

export function requiredTopics(level: string): string[] {
  const skip = NOT_REQUIRED[level] ?? [];
  return getTopicOptions(level).filter((topic) => !skip.includes(topic));
}

// For SQL (levels as numbers): { "0": [{ "topic": "If else", "subtopics": [] }, ...],
//                                "1": [{ "topic": "Maths", "subtopics": ["Digit Manipulation", ...] }, ...] }
export function requiredTopicsByLevelNumber(): Record<string, Array<{ topic: string; subtopics: string[] }>> {
  return Object.fromEntries(LEVELS.map((level, index) => [
    String(index),
    requiredTopics(level).map((topic) => ({ topic, subtopics: getSubtopicOptions(level, topic) })),
  ]));
}
