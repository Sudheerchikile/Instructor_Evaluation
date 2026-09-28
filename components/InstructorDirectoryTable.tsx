'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react';
import { InstructorListEntry } from '@/lib/types';
import { fetchInstructors } from '@/lib/api';

// Admin-only Instructor List: full names, contact details and each instructor's assigned students.
export function InstructorDirectoryTable() {
  const [instructors, setInstructors] = useState<InstructorListEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchInstructors().then(setInstructors).catch((err: Error) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!instructors || !q) return instructors ?? [];
    return instructors.filter((inst) => [inst.id, inst.name, inst.firstName, inst.email].some((v) => v.toLowerCase().includes(q)));
  }, [instructors, search]);

  if (error) return <p className="text-xs text-red-600 dark:text-red-400">Could not load instructors: {error}</p>;
  if (!instructors) return <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />Loading instructors...</div>;

  const totalStudents = instructors.reduce((sum, inst) => sum + inst.students.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          <span className="font-mono">{instructors.length}</span> instructors · <span className="font-mono">{totalStudents}</span> students
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/70 font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              <th className="py-2.5 pl-4 pr-3">Instructor</th>
              <th className="py-2.5 px-3">ID</th>
              <th className="py-2.5 px-3">Shown in Student List as</th>
              <th className="py-2.5 px-3">Company email</th>
              <th className="py-2.5 pl-3 pr-4 text-right">Students</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-700 dark:divide-zinc-800/60 dark:text-zinc-300">
            {filtered.map((inst) => {
              const isOpen = expanded === inst.id;
              return (
                <React.Fragment key={inst.id}>
                  <tr onClick={() => setExpanded(isOpen ? null : inst.id)} className="cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                    <td className="py-2.5 pl-4 pr-3 font-medium text-zinc-900 dark:text-zinc-100">
                      <span className="inline-flex items-center gap-1.5">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
                        {inst.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-500">{inst.id}</td>
                    <td className="py-2.5 px-3">{inst.firstName}</td>
                    <td className="py-2.5 px-3 font-mono text-zinc-500">{inst.email}</td>
                    <td className="py-2.5 pl-3 pr-4 text-right font-mono">{inst.students.length}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={5} className="bg-zinc-50/60 px-4 py-3 dark:bg-zinc-950/40">
                        {inst.students.length === 0 ? (
                          <p className="text-zinc-500">No students assigned.</p>
                        ) : (
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-zinc-500">
                                <th className="py-1 pr-3 text-left font-medium">Student</th>
                                <th className="py-1 px-3 text-left font-medium">Roll ID</th>
                                <th className="py-1 px-3 text-left font-medium">Level</th>
                                <th className="py-1 px-3 text-left font-medium">Current Topic</th>
                                <th className="py-1 px-3 text-left font-medium">Current Step</th>
                                <th className="py-1 pl-3 text-right font-medium">Last Interaction</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inst.students.map((s) => (
                                <tr key={s.id}>
                                  <td className="py-1 pr-3 text-zinc-900 dark:text-zinc-100">{s.name}</td>
                                  <td className="py-1 px-3 font-mono text-zinc-500">{s.id}</td>
                                  <td className="py-1 px-3 font-mono">{s.level}</td>
                                  <td className="py-1 px-3">{s.currentTopic}</td>
                                  <td className="py-1 px-3">{s.currentStep}</td>
                                  <td className="py-1 pl-3 text-right font-mono">{s.lastInteractionDate ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-zinc-500">No instructor matches your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
