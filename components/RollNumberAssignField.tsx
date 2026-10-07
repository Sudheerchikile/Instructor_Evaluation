'use client';

import React, { useMemo } from 'react';
import { Student } from '@/lib/types';

// Roll numbers pasted in any shape: commas, spaces, new lines or tabs (e.g. a column copied from a sheet).
export function parseRollNumbers(text: string): string[] {
  return Array.from(new Set(text.split(/[\s,;]+/).map((t) => t.trim().toUpperCase()).filter(Boolean)));
}

export interface AssignmentPreview {
  ids: string[];        // every roll number entered
  toMove: Student[];    // found and not already with the target instructor
  already: number;      // found and already with the target instructor
  missing: string[];    // not in the database
  unassigned: number;   // of toMove, currently without an instructor
  fromInstructor: [string, number][]; // of toMove, how many come from each current instructor
}

// Live preview of who moves where. `targetInstructorId` is omitted for a new instructor.
export function useAssignmentPreview(students: Student[], rollText: string, targetInstructorId?: string): AssignmentPreview {
  return useMemo(() => {
    const byId = new Map(students.map((s) => [s.id, s]));
    const ids = parseRollNumbers(rollText);
    const found = ids.map((id) => byId.get(id)).filter((s): s is Student => !!s);
    const toMove = found.filter((s) => !targetInstructorId || s.instructorId !== targetInstructorId);
    const fromInstructor = new Map<string, number>();
    let unassigned = 0;
    for (const s of toMove) {
      if (s.instructorFullName) fromInstructor.set(s.instructorFullName, (fromInstructor.get(s.instructorFullName) ?? 0) + 1);
      else unassigned++;
    }
    return {
      ids,
      toMove,
      already: found.length - toMove.length,
      missing: ids.filter((id) => !byId.has(id)),
      unassigned,
      fromInstructor: [...fromInstructor.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [students, rollText, targetInstructorId]);
}

interface RollNumberAssignFieldProps {
  value: string;
  onChange: (value: string) => void;
  preview: AssignmentPreview;
  targetName: string; // "this instructor" or the instructor's name
}

export function RollNumberAssignField({ value, onChange, preview, targetName }: RollNumberAssignFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Student roll numbers to assign</label>
      <textarea
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'Paste roll numbers separated by commas, spaces or new lines\nN24H01B0064, N24H01B0240\nN24H01B0046'}
        className="w-full rounded-md border border-zinc-200 bg-white p-2.5 font-mono text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
      />
      {preview.ids.length > 0 && (
        <div className="mt-2 space-y-1 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
          <div className="font-medium text-zinc-800 dark:text-zinc-200">
            {preview.toMove.length} student{preview.toMove.length === 1 ? '' : 's'} will be assigned to {targetName}
          </div>
          {preview.fromInstructor.map(([from, count]) => (
            <div key={from}>• {count} moved from {from} <span className="text-zinc-400">(their count goes down by {count})</span></div>
          ))}
          {preview.unassigned > 0 && <div>• {preview.unassigned} currently unassigned</div>}
          {preview.already > 0 && <div>• {preview.already} already assigned to {targetName} (no change)</div>}
          {preview.missing.length > 0 && (
            <div className="text-rose-600 dark:text-rose-400">• Not found: {preview.missing.join(', ')}</div>
          )}
        </div>
      )}
    </div>
  );
}
