'use client';

import React, { useMemo } from 'react';
import { Student } from '@/lib/types';
import { LEVELS } from '@/lib/multiLevelCurriculum';

// Standing at the student's CURRENT level (computed in the DB view student_overview).
export const STATUS_KEYS = ['PENDING', 'IN_PROGRESS', 'REVISIT', 'CLEARED'] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export const STATUS_META: Record<StatusKey, { label: string; hint: string; dot: string }> = {
  PENDING:     { label: 'Not interacted yet', hint: 'no interaction at current level', dot: 'bg-zinc-400' },
  IN_PROGRESS: { label: 'In Progress',        hint: 'evaluation ongoing',              dot: 'bg-sky-500' },
  REVISIT:     { label: 'Needs Revisit',      hint: 're-evaluate',                     dot: 'bg-amber-500' },
  CLEARED:     { label: 'Cleared',            hint: 'ready for next level',            dot: 'bg-emerald-500' },
};

export function statusKeyOf(student: Student): StatusKey {
  if (student.status.includes('Revisit')) return 'REVISIT';
  if (student.status.includes('Cleared')) return 'CLEARED';
  if (student.status.includes('In Progress')) return 'IN_PROGRESS';
  return 'PENDING';
}

interface LevelOverviewProps {
  students: Student[];
  activeLevel: string;
  activeStatus: string;
  onSelect: (level: string, status: string) => void;
}

// Level x status matrix. Every cell is a shortcut that filters the student table below.
export function LevelOverview({ students, activeLevel, activeStatus, onSelect }: LevelOverviewProps) {
  const counts = useMemo(() => {
    const table = Object.fromEntries(
      LEVELS.map((level) => [level, { total: 0, PENDING: 0, IN_PROGRESS: 0, REVISIT: 0, CLEARED: 0 }])
    ) as Record<string, Record<'total' | StatusKey, number>>;
    for (const s of students) {
      const row = table[s.level];
      if (!row) continue;
      row.total++;
      row[statusKeyOf(s)]++;
    }
    return table;
  }, [students]);

  const cell = (level: string, status: string, value: number, strong = false) => {
    const isActive = activeLevel === level && activeStatus === status;
    return (
      <button
        type="button"
        disabled={value === 0}
        onClick={() => onSelect(level, status)}
        className={`w-full rounded px-2 py-1 text-right font-mono transition-colors ${
          isActive
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : value === 0
              ? 'text-zinc-300 dark:text-zinc-700 cursor-default'
              : `${strong ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'} hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer`
        }`}
      >
        {value}
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Level overview</div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Status at each student&apos;s current level · click a number to filter the table</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              <th className="py-2 pl-4 pr-2 text-left font-medium">Level</th>
              <th className="px-2 py-2 text-right font-medium">Students</th>
              {STATUS_KEYS.map((key) => (
                <th key={key} className="px-2 py-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[key].dot}`} />
                    {STATUS_META[key].label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {LEVELS.map((level) => {
              const row = counts[level];
              return (
                <tr key={level} className={row.total === 0 ? 'opacity-60' : ''}>
                  <td className="py-1 pl-4 pr-2 font-mono text-zinc-700 dark:text-zinc-300">{level}</td>
                  <td className="px-1 py-1">{cell(level, 'ALL', row.total, true)}</td>
                  {STATUS_KEYS.map((key) => (
                    <td key={key} className="px-1 py-1">{cell(level, key, row[key])}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
