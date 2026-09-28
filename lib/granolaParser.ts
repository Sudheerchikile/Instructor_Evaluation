import { ParsedTranscriptResult } from './types';

function normalizeRowText(value: string): string {
  return value
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\t+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function normalizeDateValue(value: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';

  const isoLike = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoLike) return `${isoLike[1]}-${String(isoLike[2]).padStart(2, '0')}-${String(isoLike[3]).padStart(2, '0')}`;

  const slashLike = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (slashLike) {
    const year = slashLike[3].length === 2 ? `20${slashLike[3]}` : slashLike[3];
    return `${year}-${String(slashLike[2]).padStart(2, '0')}-${String(slashLike[1]).padStart(2, '0')}`;
  }

  const monthLike = raw.match(/^(\d{1,2})[-/]([A-Za-z]{3,9})[-/](\d{2,4})$/);
  if (monthLike) {
    const monthMap: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    };
    const month = monthMap[monthLike[2].slice(0, 3).charAt(0).toUpperCase() + monthLike[2].slice(1, 3).toLowerCase()] || '01';
    const year = monthLike[3].length === 2 ? `20${monthLike[3]}` : monthLike[3];
    return `${year}-${month}-${String(monthLike[1]).padStart(2, '0')}`;
  }

  const monthName = raw.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*)?(\d{2,4})?$/i);
  if (monthName) {
    const monthMap: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    };
    const month = monthMap[monthName[1].slice(0, 3).charAt(0).toUpperCase() + monthName[1].slice(1, 3).toLowerCase()] || '01';
    const day = monthName[2];
    const year = monthName[3] || new Date().getFullYear().toString();
    return `${year}-${month}-${String(day).padStart(2, '0')}`;
  }

  return raw;
}

function splitListItems(value: string): string[] {
  if (!value) return [];
  const clean = value
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();

  if (!clean) return [];

  const segments = clean.split(/\n\s*(?=\d+\.)/).filter(Boolean);
  if (segments.length > 1) {
    return segments
      .map((segment) => segment.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }

  return clean
    .split(/(?=\s*(?:\d+\.|\u2022|[-*]\s))/)
    .map((item) => item.replace(/^\s*(?:\d+\.|\u2022|[-*])\s*/, '').trim())
    .filter(Boolean);
}

function parsePlainRowText(text: string): Partial<ParsedTranscriptResult> & {
  title?: string;
  instructor?: string;
  instructorName?: string;
  topics?: string;
  status?: 'Need to Revisit' | 'Cleared' | 'In Progress';
  meetRecording?: string;
  granolaTranscript?: string;
} {
  const result: Partial<ParsedTranscriptResult> & {
    title?: string;
    instructor?: string;
    instructorName?: string;
    topics?: string;
    status?: 'Need to Revisit' | 'Cleared' | 'In Progress';
    meetRecording?: string;
    granolaTranscript?: string;
  } = {};

  const quotedBlocks = Array.from(text.matchAll(/"((?:[^"\\]|\\.)*)"/g)).map((match) => match[1].replace(/\\n/g, '\n'));

  const dateMatch = text.match(/\b\d{1,2}[-/][A-Za-z]{3,9}[-/]\d{2,4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b/);
  if (dateMatch) result.date = normalizeDateValue(dateMatch[0]);

  const instructorMatch = text.match(/\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
  if (instructorMatch) {
    result.instructor = instructorMatch[0].trim();
    result.instructorName = instructorMatch[0].trim();
  }

  const topicMatch = text.match(/\b\d+\.\d+\s+[A-Za-z0-9&/+-][A-Za-z0-9 &/+-]*\b/);
  if (topicMatch) result.topics = topicMatch[0].trim();

  const statusMatch = text.match(/Need to Revisit|Cleared|In Progress/i);
  if (statusMatch) {
    const normalizedStatus = statusMatch[0].trim();
    result.status = normalizedStatus as 'Need to Revisit' | 'Cleared' | 'In Progress';
    result.suggestedStatus = normalizedStatus === 'Cleared' ? 'Cleared' : 'Need to Revisit';
  }

  const ratingMatch = text.match(/\b(0|1|2|3|4|5)\b(?=\s*(?:\"|\d+\.|https?:|$))/i);
  if (ratingMatch) result.suggestedRating = Number(ratingMatch[1]);

  if (quotedBlocks.length >= 4) {
    result.questionsAsked = splitListItems(quotedBlocks[0]);
    result.remarks = splitListItems(quotedBlocks[1]);
    result.improvementAreas = splitListItems(quotedBlocks[2]);
    result.actionItems = splitListItems(quotedBlocks[3]);
  } else {
    const cells = text
      .split(/\t+|\s{2,}/)
      .map((cell) => cell.trim().replace(/^['"]+|['"]+$/g, '').trim())
      .filter(Boolean);

    if (cells.length >= 5) {
      const [, , , , , ...rest] = cells;
      const values = rest.filter((cell) => cell.length > 0);
      if (values.length >= 1) result.questionsAsked = splitListItems(values[0]);
      if (values.length >= 2) result.remarks = splitListItems(values[1]);
      if (values.length >= 3) result.improvementAreas = splitListItems(values[2]);
      if (values.length >= 4) result.actionItems = splitListItems(values[3]);
    }
  }

  const matchUrl = text.match(/https?:\/\/[^\s)]+/i);
  if (matchUrl) result.meetRecording = matchUrl[0].trim();

  return result;
}

function extractFieldValue(text: string, label: string): string {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const labelPattern = new RegExp(`(?:^|\\s|\n|\|)(?:\d+\.?\s*)?${safeLabel}\s*[:\-]?\s*(.*?)(?=(?:\s|\n|\|)(?:\d+\.?\s*)?(?:Date|Instructor(?:'s)?\s*Name|Topics|Status\s+Post\s+Interaction|Rating\s+Based\s+on\s+Interaction|Questions\s+Asked\s+During\s+Interaction|Remarks\s+by\s+Instructor|Performed\s+Well|Improvement\s+Areas|Tweaked\s+Questions\s+Asked|Action\s+Items|Meet\s+Recording|Meeting\s+Title|Transcript|Granola|Date:|Meeting\s+participants)\b|$)`, 'i');

  const match = text.match(labelPattern);
  return match ? match[1].trim().replace(/\s{2,}/g, ' ') : '';
}

function parseSheetRow(rawText: string): Partial<ParsedTranscriptResult> & {
  title?: string;
  instructor?: string;
  instructorName?: string;
  topics?: string;
  status?: 'Need to Revisit' | 'Cleared' | 'In Progress';
  meetRecording?: string;
  granolaTranscript?: string;
} {
  const text = normalizeRowText(rawText);
  const result: Partial<ParsedTranscriptResult> & {
    title?: string;
    instructor?: string;
    instructorName?: string;
    topics?: string;
    status?: 'Need to Revisit' | 'Cleared' | 'In Progress';
    meetRecording?: string;
    granolaTranscript?: string;
  } = {};

  const hasSheetHeader = /(?:^|\s)(?:\d+\.|\s)?Date\s*(?:\|\s*|\s+)\s*(?:\d+\.|\s)?Instructor(?:'s)?\s*Name\s*(?:\|\s*|\s+)\s*(?:\d+\.|\s)?Topics/i.test(text)
    || /Date\s+Instructor(?:'s)?\s+Name\s+Topics/i.test(text)
    || /Status\s+Post\s+Interaction/i.test(text);

  if (!hasSheetHeader) {
    const plain = parsePlainRowText(text);
    if (plain.date || plain.instructor || plain.topics || plain.status || plain.questionsAsked?.length) {
      return plain;
    }
    return result;
  }

  const dateValue = extractFieldValue(text, 'Date');
  if (dateValue) result.date = normalizeDateValue(dateValue);

  const instructorValue = extractFieldValue(text, "Instructor's Name") || extractFieldValue(text, 'Instructor Name');
  if (instructorValue) {
    result.instructor = instructorValue;
    result.instructorName = instructorValue;
  }

  const topicsValue = extractFieldValue(text, 'Topics');
  if (topicsValue) result.topics = topicsValue;

  const statusValue = extractFieldValue(text, 'Status Post Interaction');
  if (statusValue) {
    const normalizedStatus = statusValue.match(/Need to Revisit|Cleared|In Progress/i)?.[0].trim();
    if (normalizedStatus) {
      result.status = normalizedStatus as 'Need to Revisit' | 'Cleared' | 'In Progress';
      result.suggestedStatus = normalizedStatus === 'Cleared' ? 'Cleared' : 'Need to Revisit';
    }
  }

  const ratingValue = extractFieldValue(text, 'Rating Based on Interaction');
  const ratingMatch = ratingValue.match(/(0|1|2|3|4|5)(?:\.0)?/);
  if (ratingMatch) result.suggestedRating = Number(ratingMatch[1]);

  const questionsValue = extractFieldValue(text, 'Questions Asked During Interaction');
  if (questionsValue) {
    result.questionsAsked = splitListItems(questionsValue);
  }

  const remarksValue = extractFieldValue(text, 'Remarks by Instructor');
  if (remarksValue) {
    result.remarks = splitListItems(remarksValue);
  }

  const performedValue = extractFieldValue(text, 'Performed Well');
  if (performedValue) {
    result.performedWell = splitListItems(performedValue);
  }

  const improvementValue = extractFieldValue(text, 'Improvement Areas');
  if (improvementValue) {
    result.improvementAreas = splitListItems(improvementValue);
  }

  const tweakedValue = extractFieldValue(text, 'Tweaked Questions Asked');
  if (tweakedValue) {
    result.tweakedQuestions = splitListItems(tweakedValue);
  }

  const actionValue = extractFieldValue(text, 'Action Items');
  if (actionValue) {
    result.actionItems = splitListItems(actionValue);
  }

  const meetingValue = extractFieldValue(text, 'Meet Recording');
  if (meetingValue) {
    const meetingMatch = meetingValue.match(/https?:\/\/[^\s)]+/i);
    if (meetingMatch) result.meetRecording = meetingMatch[0].trim();
  }

  const meetRecordingMatch = text.match(/https?:\/\/[^\s)]+/i);
  if (meetRecordingMatch && !result.meetRecording) result.meetRecording = meetRecordingMatch[0].trim();

  return result;
}

export function parseGranolaTranscript(rawText: string): ParsedTranscriptResult {
  if (!rawText || !rawText.trim()) {
    return {
      questionsAsked: [],
      performedWell: [],
      improvementAreas: [],
      remarks: [],
      suggestedStatus: 'Need to Revisit',
      suggestedRating: 0,
      actionItems: ['Practice implementation problems across Level 0 topics.']
    };
  }

  const normalized = normalizeRowText(rawText);
  const sheetRow = parseSheetRow(normalized);

  if (sheetRow.date || sheetRow.instructor || sheetRow.topics || sheetRow.status || sheetRow.questionsAsked?.length) {
    const date = sheetRow.date || '';
    const instructor = sheetRow.instructor || sheetRow.instructorName || '';
    const questionsAsked = sheetRow.questionsAsked || [];
    const performedWell = sheetRow.performedWell || [];
    const improvementAreas = sheetRow.improvementAreas || [];
    const remarks = sheetRow.remarks || [];
    const actionItems = sheetRow.actionItems || [];
    const suggestedStatus = (sheetRow.suggestedStatus as 'Need to Revisit' | 'Cleared') || 'Need to Revisit';
    const suggestedRating = typeof sheetRow.suggestedRating === 'number' ? sheetRow.suggestedRating : 0;

    return {
      title: '',
      date,
      instructor,
      instructorName: instructor,
      topics: sheetRow.topics || '',
      status: sheetRow.status || 'Need to Revisit',
      questionsAsked,
      performedWell,
      improvementAreas,
      remarks,
      suggestedStatus,
      suggestedRating,
      actionItems,
      tweakedQuestions: sheetRow.tweakedQuestions || [],
      meetRecording: sheetRow.meetRecording || '',
      granolaTranscript: normalized
    };
  }

  let title = '';
  let date = '';
  let instructor = '';

  const titleMatch = normalized.match(/Meeting Title:\s*(.*)/i);
  if (titleMatch) title = titleMatch[1].trim();

  const dateMatch = normalized.match(/Date:\s*(.*)/i);
  if (dateMatch) date = dateMatch[1].trim();

  const participantMatch = normalized.match(/Meeting participants:\s*(.*)/i);
  if (participantMatch) instructor = participantMatch[1].trim();

  const questionsAsked: string[] = [];
  const performedWell: string[] = [];
  const improvementAreas: string[] = [];
  const remarks: string[] = [];
  const actionItems: string[] = [];

  const lower = normalized.toLowerCase();

  if (lower.includes('declare a variable') || lower.includes('size of int')) {
    questionsAsked.push('Declare a variable in C++ / size of int in bytes');
  }
  if (lower.includes('input') && (lower.includes('output') || lower.includes('cin') || lower.includes('cout'))) {
    questionsAsked.push('How to take input & print output (a+b) in C++');
  }
  if (lower.includes('float') && lower.includes('double')) {
    questionsAsked.push('Difference between float and double types');
  }
  if (lower.includes('signed') || lower.includes('unsigned')) {
    questionsAsked.push('Concept and meaning of signed vs unsigned integers');
  }
  if (lower.includes('3 number') || lower.includes('product') || lower.includes('constraint 10^6') || lower.includes('10 to the power 6')) {
    questionsAsked.push('Product of 3 integers with constraint 10^6 (handling overflow with test cases)');
  }
  if (lower.includes('lowercase letter') || lower.includes('position') || lower.includes('alphabet') || lower.includes('ascii')) {
    questionsAsked.push('Sum of alphabet positions of 2 lowercase letters (char math / ASCII logic)');
  }
  if (lower.includes('true') && lower.includes('false') && (lower.includes('a - b') || lower.includes('a-b') || lower.includes('a+b'))) {
    questionsAsked.push('Output of int a=true; int b=false; cout << a-b');
  }
  if (lower.includes('factorial') || lower.includes('constraint n<=20') || lower.includes('at most 20')) {
    questionsAsked.push('Factorial of n (with constraint n <= 20)');
  }
  if (lower.includes('triangle') || lower.includes('equilateral') || lower.includes('isosceles') || lower.includes('scalene')) {
    questionsAsked.push('Triangle validity and classification (Equilateral, Isosceles, Scalene using if-else)');
  }
  if (lower.includes('prime') || lower.includes('divisors')) {
    questionsAsked.push('Prime number check and divisor counting');
  }
  if (lower.includes('time complexity') || lower.includes('space complexity') || lower.includes('o(n)')) {
    questionsAsked.push('Time and Space Complexity Analysis on pen and paper');
  }

  if (questionsAsked.length === 0) {
    const lines = normalized.split('\n');
    for (const l of lines) {
      if ((l.startsWith('Me:') || l.includes('?')) && l.length > 15) {
        const clean = l.replace(/^Me:\s*/i, '').trim();
        if (clean.endsWith('?') && questionsAsked.length < 8) {
          questionsAsked.push(clean);
        }
      }
    }
  }

  if (lower.includes('cin>>a>>b') || (lower.includes('input') && lower.includes('correct'))) {
    performedWell.push('Correct I/O syntax (cin >> a >> b; cout << a + b)');
  }
  if (lower.includes('smaller decimal') || (lower.includes('float') && lower.includes('double') && lower.includes('correct'))) {
    performedWell.push('Understood float vs. double distinction (precision difference)');
  }
  if (lower.includes('long long') && (lower.includes('product') || lower.includes('10^6') || lower.includes('exceeding'))) {
    performedWell.push('Identified need for long long for large numbers exceeding int range');
  }
  if (lower.includes('1 minus 1 is 0') || lower.includes('both are true') || (lower.includes('true in the sense 1') && lower.includes('correct'))) {
    performedWell.push('Correctly reasoned boolean type conversion and subtraction');
  }
  if (lower.includes('4 into 3 into 2') || (lower.includes('factorial') && lower.includes('correct'))) {
    performedWell.push('Understood factorial mathematical definition');
  }

  if (lower.includes('size of int') && (lower.includes('2 bytes') || lower.includes('8 bits') || lower.includes('wrong size'))) {
    improvementAreas.push('Standard data type sizes in C++ (int is 4 bytes / 32 bits on modern systems)');
  }
  if (lower.includes('ascii') || lower.includes('sky concept') || lower.includes('why you are taking input in int') || lower.includes('indexing starts from 0')) {
    improvementAreas.push('Character manipulation and ASCII value arithmetic (using char instead of int, offset calculation ch - \'a\' + 1)');
  }
  if (lower.includes('sum plus fact') || lower.includes('why you are summing') || lower.includes('fact sum')) {
    improvementAreas.push('Loop accumulator logic (product vs. sum initialization, fact *= i)');
  }
  if (lower.includes('convert int into long long') && lower.includes('factorial')) {
    improvementAreas.push('Proper placement of 64-bit long long types on accumulator rather than input parameter');
  }
  if (lower.includes('triangle') && (lower.includes('invalid triangle') || lower.includes('sum of any 2 side') || lower.includes('angle'))) {
    improvementAreas.push('Geometric validation conditions (triangle inequality theorem: a+b>c && b+c>a && a+c>b before classifying)');
  }
  if (lower.includes('struggles with implementation') || lower.includes('implementation issue') || lower.includes('practice on implementation')) {
    improvementAreas.push('Translating conceptual algorithmic logic into bug-free C++ code on paper');
  }

  const feedbackIndex = lower.indexOf('giving you the feedback');
  if (feedbackIndex !== -1) {
    const feedbackText = normalized.substring(feedbackIndex);
    if (feedbackText.toLowerCase().includes('implementation')) {
      remarks.push('Candidate understands theoretical high-level concepts (int vs long long, bool values) but struggles significantly with syntax implementation and boundary constraints.');
    }
    if (feedbackText.toLowerCase().includes('practice a lot') || feedbackText.toLowerCase().includes('out of practice')) {
      remarks.push('Major issue is lack of active hands-on coding practice. Got stuck on range constraints and character indexing.');
    }
  } else {
    if (improvementAreas.length > 2) {
      remarks.push('Candidate showed foundational awareness of basic types but had multiple implementation hurdles with constraints and character arithmetic.');
    } else {
      remarks.push('Good interaction overall. Answered core syntax questions with minor prompt hints.');
    }
  }

  actionItems.push('Practice implementation problems across all Level-0 topics, specifically focusing on data types, char/ASCII logic, and if-else conditions.');
  actionItems.push('Solve triangle classification and basic math overflow exercises on paper without IDE auto-complete.');

  let status: 'Need to Revisit' | 'Cleared' = 'Need to Revisit';
  let rating = 0;

  if (lower.includes('giving you the revisit') || lower.includes('revisit') || improvementAreas.length >= 3) {
    status = 'Need to Revisit';
    rating = improvementAreas.length >= 4 ? 0 : 1;
  } else if (improvementAreas.length <= 1 && performedWell.length >= 3) {
    status = 'Cleared';
    rating = 4;
  } else {
    status = 'Need to Revisit';
    rating = 2;
  }

  return {
    title,
    date,
    instructor,
    questionsAsked,
    performedWell,
    improvementAreas,
    remarks,
    suggestedStatus: status,
    suggestedRating: rating,
    actionItems
  };
}
