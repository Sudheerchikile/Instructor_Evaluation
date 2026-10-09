'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, ChevronRight, Copy, History, Loader2, Search, UserCheck, UserPlus, X } from 'lucide-react';
import { CreateInstructorResult, InstructorListEntry, InteractionLog, Student } from '@/lib/types';
import { fetchInstructors } from '@/lib/api';
import { normalizeTopicValue } from '@/lib/storage';
import { getStepOptionsForTopic, getSubtopicOptions, getTopicOptions, levelShortLabel } from '@/lib/multiLevelCurriculum';
import { AddInstructorForm } from '@/components/AddInstructorForm';
import { AssignStudentsModal } from '@/components/AssignStudentsModal';
import { InstructorHistoryModal } from '@/components/InstructorHistoryModal';

interface InstructorDirectoryTableProps {
  students: Student[];     // all students, for the Add instructor preview
  interactions: InteractionLog[]; // all interactions, for each instructor's history
  onChanged?: () => void;  // lets the page reload students after an assignment change
}

// Admin-only Instructor List: full names, contact details and each instructor's assigned students.
export function InstructorDirectoryTable({ students, interactions, onChanged }: InstructorDirectoryTableProps) {
  const [historyFor, setHistoryFor] = useState<InstructorListEntry | null>(null);
  const [instructors, setInstructors] = useState<InstructorListEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [created, setCreated] = useState<{ result: CreateInstructorResult; kind: 'created' | 'assigned' } | null>(null);
  const [assignTo, setAssignTo] = useState<InstructorListEntry | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [copied, setCopied] = useState(false);

  // Students with no instructor (e.g. "Yet to add" in the sheet), so the admin can find and assign them.
  const unassigned = useMemo(
    () => students.filter((s) => !s.instructorId).sort((a, b) => a.degree.localeCompare(b.degree) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name)),
    [students]
  );
  const copyUnassigned = async () => {
    try {
      await navigator.clipboard.writeText(unassigned.map((s) => s.id).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowUnassigned(true); // clipboard blocked: show the list so the roll numbers can be copied by hand
    }
  };

  const getLevelNumber = (level: string) => Number((level.match(/\d+/) ?? ['0'])[0]);
  const getTopicProgressionIndex = (level: string, topic?: string) => {
    const options = getTopicOptions(level);
    const normalizedTopic = normalizeTopicValue(topic ?? '');
    const match = options.findIndex((option) => normalizeTopicValue(option) === normalizedTopic);
    return match >= 0 ? match : -1;
  };
  const getStepProgressionIndex = (level: string, topic?: string, step?: string) => {
    const options = getStepOptionsForTopic(level, topic);
    const normalizedStep = (step ?? '').trim();
    const match = options.findIndex((option) => option.trim() === normalizedStep);
    return match >= 0 ? match : -1;
  };

  useEffect(() => {
    fetchInstructors().then(setInstructors).catch((err: Error) => setError(err.message));
  }, [reloadKey]);

  const handleSaved = (result: CreateInstructorResult, kind: 'created' | 'assigned') => {
    setShowAdd(false);
    setAssignTo(null);
    setCreated({ result, kind });
    setExpanded(result.instructor.id);
    setReloadKey((k) => k + 1);
    onChanged?.();
  };

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
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <span className="font-mono">{instructors.length}</span> instructors · <span className="font-mono">{totalStudents}</span> students
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add instructor
          </button>
        </div>
      </div>

      {created && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          <div className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">
                {created.kind === 'created'
                  ? `${created.result.instructor.name} (${created.result.instructor.id}) can now sign in with ${created.result.instructor.email}.`
                  : `Students assigned to ${created.result.instructor.name}.`}
              </div>
              <div className="mt-0.5">
                {created.result.assigned.length} student{created.result.assigned.length === 1 ? '' : 's'} assigned
                {(() => {
                  const moved = new Map<string, number>();
                  created.result.assigned.forEach((a) => { if (a.previousInstructor) moved.set(a.previousInstructor, (moved.get(a.previousInstructor) ?? 0) + 1); });
                  return moved.size ? ` (moved from ${[...moved.entries()].map(([n, c]) => `${n}: ${c}`).join(', ')})` : '';
                })()}
                {created.result.alreadyAssigned ? `; ${created.result.alreadyAssigned} were already theirs` : ''}.
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setCreated(null)} title="Dismiss" className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 text-xs dark:border-sky-900/60 dark:bg-sky-950/20">
          <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => setShowUnassigned((v) => !v)} className="inline-flex items-center gap-1.5 text-left font-medium text-sky-900 dark:text-sky-200 cursor-pointer">
              {showUnassigned ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <span className="font-mono">{unassigned.length}</span> student{unassigned.length === 1 ? ' has' : 's have'} no instructor yet
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-sky-800/80 dark:text-sky-300/80">Copy the roll numbers, then paste them into Assign students on an instructor&apos;s row.</span>
              <button type="button" onClick={copyUnassigned} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-sky-200 bg-white px-2 text-[11px] font-medium text-sky-800 hover:bg-sky-50 dark:border-sky-900 dark:bg-zinc-900 dark:text-sky-300 dark:hover:bg-zinc-800 cursor-pointer">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy roll numbers'}
              </button>
            </div>
          </div>
          {showUnassigned && (
            <div className="max-h-72 overflow-y-auto border-t border-sky-200 px-4 py-2 dark:border-sky-900/60">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-sky-50 text-zinc-500 dark:bg-zinc-950">
                  <tr>
                    <th className="py-1 pr-3 text-left font-medium">Student</th>
                    <th className="py-1 px-3 text-left font-medium">Roll number</th>
                    <th className="py-1 px-3 text-left font-medium">College</th>
                    <th className="py-1 px-3 text-left font-medium">Section</th>
                    <th className="py-1 pl-3 text-left font-medium">Hall</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700 dark:text-zinc-300">
                  {unassigned.map((s) => (
                    <tr key={s.id}>
                      <td className="py-1 pr-3 text-zinc-900 dark:text-zinc-100">{s.name}</td>
                      <td className="py-1 px-3 font-mono select-all">{s.id}</td>
                      <td className="py-1 px-3">{s.degree}</td>
                      <td className="py-1 px-3">{s.section}</td>
                      <td className="py-1 pl-3">{s.hall || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAdd && <AddInstructorForm students={students} onClose={() => setShowAdd(false)} onCreated={(r) => handleSaved(r, 'created')} />}
      {assignTo && <AssignStudentsModal instructor={assignTo} students={students} onClose={() => setAssignTo(null)} onAssigned={(r) => handleSaved(r, 'assigned')} />}

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/70 font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              <th className="py-2.5 pl-4 pr-3">Instructor</th>
              <th className="py-2.5 px-3">Shown in Student List as</th>
              <th className="py-2.5 px-3">Company email</th>
              <th className="py-2.5 px-3 text-right">Students</th>
              <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-700 dark:divide-zinc-800/60 dark:text-zinc-300">
            {filtered.map((inst) => {
              const isOpen = expanded === inst.id;
              const rankedStudents = [...inst.students].sort((a, b) => {
                const levelDiff = getLevelNumber(b.level) - getLevelNumber(a.level);
                if (levelDiff !== 0) return levelDiff;

                const topicDiff = getTopicProgressionIndex(b.level, b.currentTopic) - getTopicProgressionIndex(a.level, a.currentTopic);
                if (topicDiff !== 0) return topicDiff;

                const subtopicDiff = getSubtopicOptions(b.level, b.currentTopic).indexOf(b.currentSubtopic ?? '')
                  - getSubtopicOptions(a.level, a.currentTopic).indexOf(a.currentSubtopic ?? '');
                if (subtopicDiff !== 0) return subtopicDiff;

                return getStepProgressionIndex(b.level, b.currentTopic, b.currentStep) - getStepProgressionIndex(a.level, a.currentTopic, a.currentStep);
              });
              return (
                <React.Fragment key={inst.id}>
                  <tr onClick={() => setExpanded(isOpen ? null : inst.id)} className="cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                    <td className="py-2.5 pl-4 pr-3 font-medium text-zinc-900 dark:text-zinc-100">
                      <span className="inline-flex items-center gap-1.5">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
                        {inst.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">{inst.firstName}</td>
                    <td className="py-2.5 px-3 font-mono text-zinc-500">{inst.email}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{inst.students.length}</td>
                    <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAssignTo(inst); }}
                        title={`Assign students to ${inst.name}`}
                        className="mr-1.5 inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Assign students
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setHistoryFor(inst); }}
                        title={`Interactions taken by ${inst.name}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                    </td>
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
                                <th className="py-1 px-3 text-left font-medium">Level</th>
                                <th className="py-1 px-3 text-left font-medium">Current Topic</th>
                                <th className="py-1 px-3 text-left font-medium">Subtopic</th>
                                <th className="py-1 px-3 text-left font-medium">Current Step</th>
                                <th className="py-1 pl-3 text-right font-medium">Last Interaction</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rankedStudents.map((s) => (
                                <tr key={s.id}>
                                  <td className="py-1 pr-3 text-zinc-900 dark:text-zinc-100">{s.name}</td>
                                  <td className="py-1 px-3 font-mono" title={s.level}>{levelShortLabel(s.level)}</td>
                                  <td className="py-1 px-3">{s.currentTopic}</td>
                                  <td className="py-1 px-3">{s.currentSubtopic ?? '—'}</td>
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

      {historyFor && <InstructorHistoryModal instructor={historyFor} interactions={interactions} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
