// "Paste from sheet" in the Log Interaction form: turns one row of the instructors' sheet into form values.
// Accepted input:
//   - a Markdown table (| Date | Instructor's Name | Topics | ... |) with a header row, or
//   - cells copied straight from Google Sheets / Excel (tab-separated), with or without the header row.
// With a header, columns are matched by name (any order; unknown columns are ignored). Without one, the
// sheet's order is assumed:
//   Date | Topics | Status post interaction | Rating (out of 5) | Questions asked | Remarks by instructor |
//   Performed well | Improvement areas | Tweaked questions asked | Action items | Interaction cell link
// (The last column used to be "Meet recording"; both header names fill the same field, meetRecording.)
// Pure functions (no React), so they can be tested on their own.

export type SheetStatus = 'Need to Revisit' | 'Cleared' | 'In Progress';

export interface SheetRowValues {
  date?: string;            // YYYY-MM-DD
  takenByName?: string;     // "Instructor's Name" column, matched to the instructor list by the form
  topics?: string[];        // matched to the level's topic list
  status?: SheetStatus;
  rating?: number;          // whole number 0-5
  questionsAsked?: string;
  remarks?: string;
  performedWell?: string;
  improvementAreas?: string;
  tweakedQuestions?: string;
  actionItems?: string;
  meetRecording?: string;
}

export interface SheetRowResult {
  values: SheetRowValues;
  filled: number;     // fields that got a value
  warnings: string[]; // things the instructor should check by hand
}

export const SHEET_COLUMNS = [
  'Date', 'Topics', 'Status post interaction', 'Rating', 'Questions asked', 'Remarks by instructor',
  'Performed well', 'Improvement areas', 'Tweaked questions asked', 'Action items', 'Interaction cell link',
] as const;

// ---------- Tab-separated text, as Google Sheets / Excel copy it ----------
// Cells are split by tabs and rows by new lines. A cell holding a line break, tab or quote is wrapped in
// double quotes, with inner quotes doubled ("" -> ").
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  const src = text.replace(/\r\n?/g, '\n');
  let atCellStart = true;

  while (i < src.length) {
    const ch = src[i];
    if (atCellStart && ch === '"') {
      // Quoted cell: read up to the closing quote.
      i++;
      while (i < src.length) {
        if (src[i] === '"') {
          if (src[i + 1] === '"') { cell += '"'; i += 2; continue; }
          i++;
          break;
        }
        cell += src[i++];
      }
      atCellStart = false;
      continue;
    }
    if (ch === '\t') { row.push(cell); cell = ''; atCellStart = true; i++; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; atCellStart = true; i++; continue; }
    cell += ch;
    atCellStart = false;
    i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ---------- Date ----------
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

function validYmd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // e.g. 31/02
  return `${y}-${pad(m)}-${pad(d)}`;
}

const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

// Understands 2026-09-22, 22/09/2026, 9/22/2026, 22-9-26, 22.09.2026, 22 Sep 2026, Sep 22, 2026,
// Monday, September 22, 2026 and 22/09 (current year). For a/b/yyyy: a > 12 means day first, b > 12 means
// month first; if both are <= 12 it is read as day/month, unless that is in the future and month/day is not.
export function parseSheetDate(raw: string, today: string): { date?: string; warning?: string } {
  const text = raw.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (!text) return {};
  const currentYear = Number(today.slice(0, 4));
  const notFuture = (d: string | null) => (d && d <= today ? d : null);

  let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const d = validYmd(+m[1], +m[2], +m[3]);
    if (d) return d <= today ? { date: d } : { warning: `Date "${raw.trim()}" is in the future, so it was left empty.` };
  }

  m = text.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (m) {
    const a = +m[1], b = +m[2], y = m[3] ? fullYear(+m[3]) : currentYear;
    const dayFirst = validYmd(y, b, a);
    const monthFirst = validYmd(y, a, b);
    let d: string | null = null;
    if (a > 12) d = dayFirst;
    else if (b > 12) d = monthFirst;
    else d = notFuture(dayFirst) ?? notFuture(monthFirst) ?? dayFirst;
    if (d) return d <= today ? { date: d } : { warning: `Date "${raw.trim()}" is in the future, so it was left empty.` };
  }

  // Month names: "22 sep 2026", "sep 22 2026", "monday september 22 2026", "22-sep-2026".
  const words = text.replace(/[-/.]/g, ' ').split(' ').filter(Boolean);
  const monthIdx = words.findIndex((w) => MONTHS.includes(w.slice(0, 3)) && /^[a-z]+$/.test(w));
  if (monthIdx >= 0) {
    const month = MONTHS.indexOf(words[monthIdx].slice(0, 3)) + 1;
    const nums = words.filter((w) => /^\d+(st|nd|rd|th)?$/.test(w)).map((w) => parseInt(w, 10));
    const day = nums.find((n) => n >= 1 && n <= 31 && n < 100);
    const year = nums.find((n) => n >= 1000) ?? currentYear;
    const d = day ? validYmd(year, month, day) : null;
    if (d) return d <= today ? { date: d } : { warning: `Date "${raw.trim()}" is in the future, so it was left empty.` };
  }

  return { warning: `Could not read the date "${raw.trim()}". Pick it in the Date field.` };
}

// ---------- Topics ----------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Common short forms instructors write, keyed by the curriculum topic name.
const TOPIC_ALIASES: Record<string, string[]> = {
  'Introduction': ['intro'],
  'Data Types': ['datatype'],
  'If else': ['ifelse', 'conditions', 'conditionals'],
  'Loops': ['loop'],
  'Traversal': ['traversal', 'traversing'],
  'Time & Space Complexity analysis': ['timecomplexity', 'spacecomplexity', 'complexity', 'tcsc'],
  'Pattern Questions': ['pattern'],
  'Maths': ['math'],
  'STL': ['standardtemplatelibrary'],
  'String': ['strings'],
  'Recursion - Basics': ['recursion'],
  'Recursion - Advanced': ['recursion'],
  'Two pointers / Sliding window': ['twopointer', 'slidingwindow'],
  'Greedy Algorithms': ['greedy'],
  'Bit Manipulation': ['bitmanipulation', 'bits'],
  'Stack & Queues': ['stack', 'queue'],
  'Stack - Monotonic Stack': ['monotonic'],
  "Heaps / PQ's": ['heap', 'priorityqueue', 'pq'],
  'Linked list': ['linkedlist'],
  'Dynamic Programming': ['dp', 'dynamicprogramming'],
  'Binary Trees': ['binarytree'],
  'Binary Search Trees': ['bst', 'binarysearchtree'],
  'Graphs': ['graph'],
};

// Smallest edit distance between `needle` and any substring of `hay` (typos such as "Travsersals").
function fuzzyContains(hay: string, needle: string): number {
  let prev = new Array(hay.length + 1).fill(0);
  for (let i = 1; i <= needle.length; i++) {
    const cur = [i];
    for (let j = 1; j <= hay.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (needle[i - 1] === hay[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return Math.min(...prev);
}

// Splits "1.1 Data types 1.2 If Else, Loops / 2 Traversal" into topic-sized pieces and matches each one to
// the level's topics: exact name first, then known short forms, then a close spelling.
export function matchTopics(raw: string, options: string[]): { topics: string[]; unmatched: string[] } {
  const segments = raw
    .split(/[\n,;|]+|(?:^|\s)\d+(?:\.\d+)*\s*[-.):]?(?=\s|[a-z])/i)
    .map((s) => s?.trim())
    .filter((s): s is string => !!s && /[a-z]/i.test(s));

  const found: string[] = [];
  const unmatched: string[] = [];
  const add = (t: string) => { if (!found.includes(t)) found.push(t); };

  for (const segment of segments) {
    const key = norm(segment);
    if (!key) continue;

    const exact = options.filter((t) => { const k = norm(t); return key.includes(k) || (key.length >= 4 && k.includes(key)); });
    if (exact.length) { exact.forEach(add); continue; }

    const alias = options.filter((t) => (TOPIC_ALIASES[t] ?? []).some((a) => key.includes(a)));
    if (alias.length) { alias.forEach(add); continue; }

    let best: { topic: string; dist: number } | null = null;
    for (const t of options) {
      for (const k of [norm(t), ...(TOPIC_ALIASES[t] ?? [])]) {
        const allowed = k.length >= 8 ? 2 : k.length >= 5 ? 1 : 0;
        const dist = fuzzyContains(key, k);
        if (dist <= allowed && (!best || dist < best.dist)) best = { topic: t, dist };
      }
    }
    if (best) add(best.topic);
    else unmatched.push(segment);
  }
  return { topics: found, unmatched };
}

// ---------- Status and rating ----------
export function parseSheetStatus(raw: string): SheetStatus | undefined {
  const t = raw.toLowerCase();
  if (!t.trim()) return undefined;
  if (/not\s*clear|revis|revist|re-?visit|rework|repeat/.test(t)) return 'Need to Revisit';
  if (/progress|ongoing|partial|pending/.test(t)) return 'In Progress';
  if (/clear|pass|done|complet/.test(t)) return 'Cleared';
  return undefined;
}

// "3", "3/5", "3 out of 5", "3 out of 3", "Rating: 3" -> 3. The first number is the rating.
export function parseSheetRating(raw: string): { rating?: number; warning?: string } {
  const m = raw.match(/\d+(?:\.\d+)?/);
  if (!raw.trim()) return {};
  if (!m) return { warning: `Could not read the rating "${raw.trim()}". Pick it by hand.` };
  const value = Number(m[0]);
  if (value > 5) return { warning: `Rating "${raw.trim()}" is above 5, so it was left as is.` };
  const rounded = Math.round(value);
  return rounded === value ? { rating: value } : { rating: rounded, warning: `Rating "${raw.trim()}" was rounded to ${rounded}.` };
}

// ---------- Markdown table ----------
// | a | b |  rows; the |---|---:| separator row is dropped. "\|" inside a cell is a literal pipe.
export function parseMarkdownTable(text: string): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) => {
      const cells = line.replace(/\\\|/g, '\u0000').split('|').map((c) => c.replace(/\u0000/g, '|').trim());
      return cells.slice(1, line.endsWith('|') ? -1 : undefined);
    })
    .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c) || c === ''));
}

// Markdown / sheet artefacts -> plain text: <br> line breaks, [text](url) links, `code`, **bold**, and
// "NA" style placeholders meaning "nothing to fill".
function cleanCell(raw: string): string {
  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => (label.trim() === url || !label.trim() ? url : `${label} (${url})`))
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim();
  return /^(na|n\/a|nil|none|-+|—)$/i.test(text) ? '' : text;
}

// Header text -> field. Order matters: "Remarks by Instructor" and "Performed Well (Concepts/Topics)"
// must not be taken for the instructor or topics columns.
type Column = 'date' | 'instructor' | 'topics' | 'status' | 'rating' | 'questions' | 'remarks' | 'performed' | 'improvement' | 'tweaked' | 'actions' | 'meet';
const HEADER_RULES: Array<[Column, RegExp]> = [
  ['performed', /perfo?r?med|well/],
  ['improvement', /improv/],
  ['tweaked', /twee?k/],
  ['remarks', /remark/],
  ['questions', /question/],
  ['status', /status/],
  ['rating', /rating|score/],
  // Before 'actions': "Interaction cell link" contains the word "action".
  ['meet', /link|meet|record|granola/],
  ['actions', /action\s*item|^actions?$/],
  ['date', /^date|date$/],
  ['topics', /topic/],
  ['instructor', /instructor|taken\s*by/],
];
const POSITIONAL: Column[] = ['date', 'topics', 'status', 'rating', 'questions', 'remarks', 'performed', 'improvement', 'tweaked', 'actions', 'meet'];

function columnOf(header: string): Column | undefined {
  const h = header.toLowerCase().replace(/\s+/g, ' ').trim();
  return HEADER_RULES.find(([, re]) => re.test(h))?.[0];
}

// A header row names at least the date and topics columns.
function isHeaderRow(cells: string[]): boolean {
  const cols = cells.map(columnOf);
  return cols.includes('date') && cols.includes('topics') && !cells.some((c) => /\d{1,4}[-/.]\d{1,2}/.test(c));
}

// ---------- One pasted row -> form values ----------
export function parseSheetRow(text: string, topicOptions: string[], today: string): SheetRowResult {
  const warnings: string[] = [];
  const isMarkdown = text.split(/\r?\n/).some((line) => line.trim().startsWith('|'));
  let rows = (isMarkdown ? parseMarkdownTable(text) : parseTsv(text)).map((r) => r.map((c) => c.trim()));

  let columns: (Column | undefined)[] = POSITIONAL;
  if (rows.length && isHeaderRow(rows[0])) {
    columns = rows[0].map(columnOf);
    rows = rows.slice(1);
  }
  if (!rows.length) return { values: {}, filled: 0, warnings: ['Nothing to fill: paste the header row and one row of the sheet.'] };
  if (rows.length > 1) warnings.push(`${rows.length} rows were pasted; only the first one was used.`);

  const row = rows[0];
  if (row.length === 1) {
    return { values: {}, filled: 0, warnings: ['No columns found. Paste the sheet as a table, or copy the cells straight from the sheet.'] };
  }
  if (columns === POSITIONAL) {
    if (row.length < POSITIONAL.length) warnings.push(`Only ${row.length} of ${POSITIONAL.length} columns were pasted; the rest were left as they are.`);
    if (row.length > POSITIONAL.length) warnings.push(`${row.length} columns were pasted without a header row; only the first ${POSITIONAL.length} were used. Paste the header row too so columns are matched by name.`);
  }

  const cell: Partial<Record<Column, string>> = {};
  columns.forEach((col, i) => { if (col && cell[col] === undefined && row[i] !== undefined) cell[col] = cleanCell(row[i]); });
  const { date, instructor, topics, status, rating, questions, remarks, performed: performedWell, improvement, tweaked, actions } = cell;
  const meet = cell.meet?.match(/https?:\/\/[^\s)]+/)?.[0] ?? cell.meet;
  const values: SheetRowValues = {};
  if (instructor) values.takenByName = instructor;

  if (date) {
    const r = parseSheetDate(date, today);
    if (r.date) values.date = r.date;
    if (r.warning) warnings.push(r.warning);
  }
  if (topics) {
    const r = matchTopics(topics, topicOptions);
    if (r.topics.length) values.topics = r.topics;
    if (r.unmatched.length) warnings.push(`Topics not found for this level: ${r.unmatched.map((u) => `"${u}"`).join(', ')}. Pick them in Topics.`);
  }
  if (status) {
    const s = parseSheetStatus(status);
    if (s) values.status = s; else warnings.push(`Could not read the status "${status}". Pick it by hand.`);
  }
  if (rating) {
    const r = parseSheetRating(rating);
    if (r.rating !== undefined) values.rating = r.rating;
    if (r.warning) warnings.push(r.warning);
  }
  if (questions) values.questionsAsked = questions;
  if (remarks) values.remarks = remarks;
  if (performedWell) values.performedWell = performedWell;
  if (improvement) values.improvementAreas = improvement;
  if (tweaked) values.tweakedQuestions = tweaked;
  if (actions) values.actionItems = actions;
  if (meet) {
    if (/^https?:\/\/\S+$/i.test(meet)) values.meetRecording = meet;
    else warnings.push(`Interaction cell link "${meet}" is not a link, so it was left empty.`);
  }

  return { values, filled: Object.keys(values).length, warnings };
}
