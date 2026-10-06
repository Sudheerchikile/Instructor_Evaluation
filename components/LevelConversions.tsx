'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { LevelConversion, Student } from '@/lib/types';
import { LEVELS } from '@/lib/multiLevelCurriculum';
import { todayLocal } from '@/lib/dates';
import { fetchLevelConversions } from '@/lib/api';

interface LevelConversionsProps {
  students: Student[];
  currentInstructorId?: string | null; // instructors can narrow the counts to their own students
}

type Period = 'today' | 'date' | 'range';

// Level 0 → Level 1, Level 1 → Level 2, … one row per boundary.
const BOUNDARIES = LEVELS.slice(0, -1).map((from, i) => ({ from, to: LEVELS[i + 1] }));

// "2026-10-05" → "5 Oct 2026"
function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Students who moved up a level today, on a chosen date, or within a date range.
// The server nets each student's changes per day, so a promotion undone the same day is not counted.
export function LevelConversions({ students, currentInstructorId }: LevelConversionsProps) {
  const today = todayLocal();
  const [conversions, setConversions] = useState<LevelConversion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('today');
  const [day, setDay] = useState(today);
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);
  const [college, setCollege] = useState('ALL');
  const [onlyMine, setOnlyMine] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null); // fromLevel of the opened row

  // Fetched each time Analytics opens, so promotions made since are included.
  useEffect(() => {
    let cancelled = false;
    fetchLevelConversions()
      .then((rows) => { if (!cancelled) setConversions(rows); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const colleges = useMemo(() => Array.from(new Set(students.map((s) => s.degree))).sort(), [students]);

  // Selected period as an inclusive [from, to]; a reversed range is read the right way round.
  const [from, to] = period === 'today' ? [today, today]
    : period === 'date' ? [day, day]
    : rangeFrom <= rangeTo ? [rangeFrom, rangeTo] : [rangeTo, rangeFrom];
  const periodLabel = period === 'today' ? 'Today'
    : from === to ? formatDay(from)
    : `${formatDay(from)} – ${formatDay(to)}`;

  const { rows, total } = useMemo(() => {
    const inPeriod = (conversions ?? []).filter((c) => {
      const student = studentById.get(c.studentId);
      if (!student || c.date < from || c.date > to) return false;
      if (college !== 'ALL' && student.degree !== college) return false;
      if (onlyMine && student.instructorId !== currentInstructorId) return false;
      return true;
    });
    const rows = BOUNDARIES.map(({ from: fromLevel, to: toLevel }) => ({
      fromLevel,
      toLevel,
      // Latest first, then by name.
      items: inPeriod
        .filter((c) => c.fromLevel === fromLevel)
        .map((c) => ({ ...c, student: studentById.get(c.studentId)! }))
        .sort((a, b) => b.date.localeCompare(a.date) || a.student.name.localeCompare(b.student.name)),
    }));
    return { rows, total: inPeriod.length };
  }, [conversions, studentById, from, to, college, onlyMine, currentInstructorId]);

  const inputClass = 'rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] text-zinc-700 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 cursor-pointer';
  const clampToToday = (value: string) => (value > today ? today : value);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
      <div className="flex flex-col gap-3 mb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
            Level Conversions
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">Students who moved up a level. Click a row to see who.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={period} onChange={(e) => { setPeriod(e.target.value as Period); setExpanded(null); }} aria-label="Period" className={inputClass}>
            <option value="today">Today</option>
            <option value="date">Custom date</option>
            <option value="range">Date range</option>
          </select>
          {period === 'date' && (
            <input type="date" value={day} max={today} aria-label="Date"
              onChange={(e) => e.target.value && setDay(clampToToday(e.target.value))} className={inputClass} />
          )}
          {period === 'range' && (
            <>
              <input type="date" value={rangeFrom} max={today} aria-label="From date"
                onChange={(e) => e.target.value && setRangeFrom(clampToToday(e.target.value))} className={inputClass} />
              <span className="text-[11px] text-zinc-500">to</span>
              <input type="date" value={rangeTo} max={today} aria-label="To date"
                onChange={(e) => e.target.value && setRangeTo(clampToToday(e.target.value))} className={inputClass} />
            </>
          )}
          <select value={college} onChange={(e) => setCollege(e.target.value)} aria-label="College" className={inputClass}>
            <option value="ALL">All colleges</option>
            {colleges.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {currentInstructorId && (
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
              My students
            </label>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">Could not load level conversions: {error}</p>
      ) : !conversions ? (
        <p className="text-xs text-zinc-500">Loading level conversions…</p>
      ) : (
        <>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
              <tr>
                <th className="py-2 pl-2 pr-2">Conversion</th>
                <th className="py-2 px-3 text-right">{periodLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
              {rows.map(({ fromLevel, toLevel, items }) => {
                const open = expanded === fromLevel;
                return (
                  <React.Fragment key={fromLevel}>
                    <tr
                      className={`transition-colors ${items.length ? 'cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40' : ''}`}
                      onClick={() => items.length && setExpanded(open ? null : fromLevel)}
                    >
                      <td className="py-2 pl-2 pr-2 font-medium text-zinc-900 dark:text-zinc-100">
                        <span className="inline-flex items-center gap-1">
                          {fromLevel} → {toLevel}
                          {items.length > 0 && (open ? <ChevronUp className="h-3 w-3 text-zinc-400" /> : <ChevronDown className="h-3 w-3 text-zinc-400" />)}
                        </span>
                      </td>
                      <td className={`py-2 px-3 text-right font-mono ${items.length ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}`}>{items.length}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={2} className="bg-zinc-50/80 px-3 py-2 dark:bg-zinc-950/60">
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-left text-[11px]">
                              <thead className="sticky top-0 bg-zinc-50 text-zinc-500 dark:bg-zinc-950">
                                <tr>
                                  <th className="py-1.5 pr-3 font-medium">Student</th>
                                  <th className="py-1.5 px-3 font-medium">Assigned instructor</th>
                                  <th className="py-1.5 pl-3 text-right font-medium">Date cleared</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/60">
                                {items.map((c) => (
                                  <tr key={`${c.studentId}-${c.date}`}>
                                    <td className="py-1.5 pr-3 text-zinc-900 dark:text-zinc-100">{c.student.name}</td>
                                    <td className="py-1.5 px-3">{c.student.instructorFullName ?? c.student.instructor}</td>
                                    <td className="py-1.5 pl-3 text-right font-mono"
                                      title={c.estimated ? 'From the last interaction before the level change (changed before tracking started)' : undefined}>
                                      {formatDay(c.date)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              <tr className="border-t border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100">
                <td className="py-2 pl-2 pr-2">Total</td>
                <td className="py-2 px-3 text-right font-mono">{total}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-zinc-500">
            A promotion reversed on the same day is not counted. College and instructor filters use current assignments.
            Promotions made before tracking started (6 Oct 2026) are dated by the last interaction before the change.
          </p>
        </>
      )}
    </div>
  );
}
