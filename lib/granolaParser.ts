import { ParsedTranscriptResult } from './types';

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

  let title = '';
  let date = '';
  let instructor = '';

  const titleMatch = rawText.match(/Meeting Title:\s*(.*)/i);
  if (titleMatch) title = titleMatch[1].trim();

  const dateMatch = rawText.match(/Date:\s*(.*)/i);
  if (dateMatch) date = dateMatch[1].trim();

  const participantMatch = rawText.match(/Meeting participants:\s*(.*)/i);
  if (participantMatch) instructor = participantMatch[1].trim();

  const questionsAsked: string[] = [];
  const performedWell: string[] = [];
  const improvementAreas: string[] = [];
  const remarks: string[] = [];
  const actionItems: string[] = [];

  const lower = rawText.toLowerCase();

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
    const lines = rawText.split('\n');
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
    const feedbackText = rawText.substring(feedbackIndex);
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
