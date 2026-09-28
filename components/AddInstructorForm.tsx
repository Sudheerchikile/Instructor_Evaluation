'use client';

import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, UserPlus, X } from 'lucide-react';
import { CreateInstructorResult, Student } from '@/lib/types';
import { createInstructor } from '@/lib/api';

const MIN_PASSWORD_LENGTH = 8; // must match db/queries.ts

interface AddInstructorFormProps {
  students: Student[]; // all students (admin view), for the live assignment preview
  onClose: () => void;
  onCreated: (result: CreateInstructorResult) => void;
}

// Roll numbers pasted in any shape: commas, spaces, new lines or tabs (e.g. a column copied from a sheet).
function parseRollNumbers(text: string): string[] {
  return Array.from(new Set(text.split(/[\s,;]+/).map((t) => t.trim().toUpperCase()).filter(Boolean)));
}

export function AddInstructorForm({ students, onClose, onCreated }: AddInstructorFormProps) {
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rollText, setRollText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const byId = new Map(students.map((s) => [s.id, s]));
    const ids = parseRollNumbers(rollText);
    const found = ids.map((id) => byId.get(id)).filter((s): s is Student => !!s);
    const missing = ids.filter((id) => !byId.has(id));
    const fromInstructor = new Map<string, number>();
    let unassigned = 0;
    for (const s of found) {
      if (s.instructorFullName) fromInstructor.set(s.instructorFullName, (fromInstructor.get(s.instructorFullName) ?? 0) + 1);
      else unassigned++;
    }
    return { ids, found, missing, unassigned, fromInstructor: [...fromInstructor.entries()].sort((a, b) => b[1] - a[1]) };
  }, [rollText, students]);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD_LENGTH) { setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    if (preview.missing.length) { setError(`Remove roll numbers that aren't in the database: ${preview.missing.join(', ')}`); return; }
    setSaving(true);
    try {
      const result = await createInstructor({ name, firstName, email, password, studentIds: preview.ids });
      onCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the instructor.');
      setSaving(false);
    }
  };

  const inp = 'h-8 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100';
  const label = 'mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/50 p-4 backdrop-blur-2xs">
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3.5 dark:border-zinc-800">
          <div>
            <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Add instructor</div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Creates their login and assigns the listed students to them.</p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto p-6 text-xs">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={label}>Full name <span className="text-rose-500">*</span></label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Kumar Sharma" className={inp} />
            </div>
            <div>
              <label className={label}>Name shown in Student List <span className="text-rose-500">*</span></label>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Rahul (must be unique)" className={inp} />
            </div>
            <div>
              <label className={label}>Company email (login) <span className="text-rose-500">*</span></label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="firstname.lastname@nxtwave.co.in" autoComplete="off" className={inp} />
            </div>
            <div>
              <label className={label}>Password <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input required type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} autoComplete="new-password" className={`${inp} pr-9`} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" title={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className={label}>Student roll numbers to assign</label>
            <textarea
              rows={5}
              value={rollText}
              onChange={(e) => setRollText(e.target.value)}
              placeholder={'Paste roll numbers separated by commas, spaces or new lines\nN24H01B0064, N24H01B0240\nN24H01B0046'}
              className="w-full rounded-md border border-zinc-200 bg-white p-2.5 font-mono text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {preview.ids.length > 0 && (
              <div className="mt-2 space-y-1 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                <div className="font-medium text-zinc-800 dark:text-zinc-200">
                  {preview.found.length} student{preview.found.length === 1 ? '' : 's'} will be assigned to this instructor
                </div>
                {preview.fromInstructor.map(([from, count]) => (
                  <div key={from}>• {count} moved from {from} <span className="text-zinc-400">(their count goes down by {count})</span></div>
                ))}
                {preview.unassigned > 0 && <div>• {preview.unassigned} currently unassigned</div>}
                {preview.missing.length > 0 && (
                  <div className="text-rose-600 dark:text-rose-400">• Not found: {preview.missing.join(', ')}</div>
                )}
              </div>
            )}
          </div>

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}

          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <button type="button" onClick={onClose} className="h-8 rounded-md border border-zinc-200 px-3 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-4 font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white cursor-pointer">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              <span>Create instructor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
