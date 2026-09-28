'use client';

import React, { useMemo, useState } from 'react';
import { InteractionLog, Student } from '@/lib/types';
import { todayLocal } from '@/lib/dates';

type Outcome = 'cleared' | 'revisit' | 'inProgress';
interface DayCell { students: number; cleared: number; revisit: number; inProgress: number }

const RANGES = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '14', label: 'Last 14 days', days: 14 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: 'all', label: 'All time', days: 0 },
] as const;

const emptyCell = (): DayCell => ({ students: 0, cleared: 0, revisit: 0, inProgress: 0 });

function outcomeOf(log: InteractionLog): Outcome {
  if (log.statusPostInteraction === 'Cleared') return 'cleared';
  if (log.statusPostInteraction.includes('Revisit')) return 'revisit';
  return 'inProgress';
}

// Local YYYY-MM-DD for `offset` days before today.
function daysAgo(offset: number): string {
  const [y, m, d] = todayLocal().split('-').map(Number);
  const date = new Date(y, m - 1, d - offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

interface DailyCollegeOverviewProps {
  students: Student[];
  interactions: InteractionLog[];
  currentInstructorId?: string | null; // instructors can narrow the table to their own students
}

// Day-by-day, college-wise interaction outcomes. A student interacted with several times on one day
// is counted once, using their latest outcome that day.
export function DailyCollegeOverview({ students, interactions, currentInstructorId }: DailyCollegeOverviewProps) {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]['key']>('7');
  const [onlyMine, setOnlyMine] = useState(false);

  const colleges = useMemo(() => Array.from(new Set(students.map((s) => s.degree))).sort(), [students]);

  const { rows, totals } = useMemo(() => {
    const studentById = new Map(students.map((s) => [s.id, s]));
    const range = RANGES.find((r) => r.key === rangeKey)!;
    const fromDate = range.days ? daysAgo(range.days - 1) : '';

    // latest log per (day, student)
    const latest = new Map<string, InteractionLog>();
    for (const log of interactions) {
      const student = studentById.get(log.studentId);
      if (!student || (fromDate && log.date < fromDate)) continue;
      if (onlyMine && student.instructorId !== currentInstructorId) continue;
      const key = `${log.date}|${log.studentId}`;
      const prev = latest.get(key);
      if (!prev || log.createdAt > prev.createdAt) latest.set(key, log);
    }

    const byDay = new Map<string, Record<string, DayCell>>();
    const ensureDay = (day: string) => {
      if (!byDay.has(day)) byDay.set(day, Object.fromEntries(colleges.map((c) => [c, emptyCell()])));
      return byDay.get(day)!;
    };
    // With a fixed range, show every day (zeros included) so quiet days are visible.
    if (range.days) for (let i = 0; i < range.days; i++) ensureDay(daysAgo(i));

    for (const [key, log] of latest) {
      const [day, studentId] = key.split('|');
      const college = studentById.get(studentId)!.degree;
      const cell = ensureDay(day)[college] ?? (ensureDay(day)[college] = emptyCell());
      cell.students++;
      cell[outcomeOf(log)]++;
    }

    const sorted = [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));
    const sum: Record<string, DayCell> = Object.fromEntries(colleges.map((c) => [c, emptyCell()]));
    for (const [, cells] of sorted) {
      for (const c of colleges) {
        (Object.keys(sum[c]) as (keyof DayCell)[]).forEach((k) => { sum[c][k] += cells[c]?.[k] ?? 0; });
      }
    }
    return { rows: sorted, totals: sum };
  }, [students, interactions, colleges, rangeKey, onlyMine, currentInstructorId]);

  const today = todayLocal();
  const num = (value: number, tone?: 'green' | 'amber' | 'sky') => (
    <span className={`font-mono ${value === 0 ? 'text-zinc-300 dark:text-zinc-700' : tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : tone === 'sky' ? 'text-sky-600 dark:text-sky-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
      {value}
    </span>
  );
  const cellGroup = (cell: DayCell | undefined, strong = false) => {
    const c = cell ?? emptyCell();
    return (
      <>
        <td className={`border-l border-zinc-200 px-2 py-1.5 text-right dark:border-zinc-800 ${strong ? 'font-semibold' : ''}`}>{num(c.students)}</td>
        <td className="px-2 py-1.5 text-right">{num(c.cleared, 'green')}</td>
        <td className="px-2 py-1.5 text-right">{num(c.revisit, 'amber')}</td>
        <td className="px-2 py-1.5 text-right">{num(c.inProgress, 'sky')}</td>
      </>
    );
  };
  const combined = (cells: Record<string, DayCell>) =>
    colleges.reduce((acc, c) => {
      (Object.keys(acc) as (keyof DayCell)[]).forEach((k) => { acc[k] += cells[c]?.[k] ?? 0; });
      return acc;
    }, emptyCell());

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Daily overview by college</div>
          <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Students interacted with each day and their outcome that day (latest interaction if more than one).
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentInstructorId && (
            <div className="flex rounded-md border border-zinc-200 p-0.5 text-[11px] dark:border-zinc-800">
              {[{ mine: false, label: 'All students' }, { mine: true, label: 'My students' }].map(({ mine, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setOnlyMine(mine)}
                  className={`rounded px-2 py-1 font-medium cursor-pointer ${onlyMine === mine ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <select
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value as typeof rangeKey)}
            className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-700 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          >
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-50/70 text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
              <th rowSpan={2} className="py-2 pl-3 pr-2 text-left font-medium">Date</th>
              {[...colleges, 'Total'].map((c) => (
                <th key={c} colSpan={4} className="border-l border-zinc-200 px-2 pt-2 text-center font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">{c}</th>
              ))}
            </tr>
            <tr className="border-b border-zinc-200 bg-zinc-50/70 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              {[...colleges, 'Total'].map((c) => (
                <React.Fragment key={c}>
                  <th className="border-l border-zinc-200 px-2 pb-2 text-right font-medium dark:border-zinc-800">Students</th>
                  <th className="px-2 pb-2 text-right font-medium">Cleared</th>
                  <th className="px-2 pb-2 text-right font-medium">Revisit</th>
                  <th className="px-2 pb-2 text-right font-medium">In progress</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {rows.map(([day, cells]) => (
              <tr key={day} className={day === today ? 'bg-zinc-50/60 dark:bg-zinc-800/30' : ''}>
                <td className="py-1.5 pl-3 pr-2 font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {day}{day === today && <span className="ml-1.5 rounded bg-zinc-200 px-1 py-0.5 font-sans text-[10px] text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Today</span>}
                </td>
                {colleges.map((c) => <React.Fragment key={c}>{cellGroup(cells[c])}</React.Fragment>)}
                {cellGroup(combined(cells), true)}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={1 + (colleges.length + 1) * 4} className="py-8 text-center text-zinc-500">No interactions in this period.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50/70 font-semibold dark:border-zinc-800 dark:bg-zinc-900/60">
                <td className="py-2 pl-3 pr-2 text-zinc-700 dark:text-zinc-300">Period total</td>
                {colleges.map((c) => <React.Fragment key={c}>{cellGroup(totals[c], true)}</React.Fragment>)}
                {cellGroup(combined(totals), true)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">
        Period totals add up each day, so a student interacted with on two different days is counted on both days.
      </p>
    </div>
  );
}
