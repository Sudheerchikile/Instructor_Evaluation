'use client';

import React, { useState } from 'react';
import { Loader2, UserCheck, X } from 'lucide-react';
import { CreateInstructorResult, InstructorListEntry, Student } from '@/lib/types';
import { assignStudentsToInstructor } from '@/lib/api';
import { blockKeyboardSubmit } from '@/lib/forms';
import { RollNumberAssignField, useAssignmentPreview } from '@/components/RollNumberAssignField';

interface AssignStudentsModalProps {
  instructor: InstructorListEntry;
  students: Student[]; // all students (admin view), for the live preview
  onClose: () => void;
  onAssigned: (result: CreateInstructorResult) => void;
}

// Admin: give an existing instructor more students. Each listed student moves from their current instructor.
export function AssignStudentsModal({ instructor, students, onClose, onAssigned }: AssignStudentsModalProps) {
  const [rollText, setRollText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const preview = useAssignmentPreview(students, rollText, instructor.id);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');
    if (!preview.ids.length) { setError('Paste at least one roll number.'); return; }
    if (preview.missing.length) { setError(`Remove roll numbers that aren't in the database: ${preview.missing.join(', ')}`); return; }
    if (!preview.toMove.length) { setError(`All of these students are already assigned to ${instructor.name}.`); return; }
    setSaving(true);
    try {
      onAssigned(await assignStudentsToInstructor(instructor.id, preview.ids));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign the students.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/50 p-4 backdrop-blur-2xs">
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3.5 dark:border-zinc-800">
          <div>
            <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Assign students to {instructor.name}</div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {instructor.email} · currently {instructor.students.length} student{instructor.students.length === 1 ? '' : 's'}. Listed students move from their current instructor.
            </p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={blockKeyboardSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto p-6 text-xs">
          <RollNumberAssignField value={rollText} onChange={setRollText} preview={preview} targetName={instructor.name} />

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}

          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <button type="button" onClick={onClose} className="h-8 rounded-md border border-zinc-200 px-3 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-4 font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white cursor-pointer">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
              <span>Assign {preview.toMove.length || ''} student{preview.toMove.length === 1 ? '' : 's'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
