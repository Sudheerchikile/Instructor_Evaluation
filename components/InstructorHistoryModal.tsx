'use client';

import React, { useMemo, useState } from 'react';
import { InteractionLog } from '@/lib/types';
import { formatLogTopics, instructorNamesMatch } from '@/lib/storage';
import { DateRangeFilter, useDateRange } from '@/components/DateRangeFilter';
import { ChevronDown, ChevronUp, Clock, ExternalLink, Mail, Search, User, X } from 'lucide-react';
import { Field, Stat, StatusBadge } from '@/components/StudentHistoryModal';

interface InstructorHistoryModalProps {
  instructor: { id: string; name: string; firstName: string; email: string };
  interactions: InteractionLog[]; // every interaction; filtered here to the ones this instructor took
  onClose: () => void;
}

// Admin view: every interaction TAKEN BY one instructor, latest first. Same reading panel as StudentHistoryModal.
export function InstructorHistoryModal({ instructor, interactions, onClose }: InstructorHistoryModalProps) {
  const [search, setSearch] = useState('');

  const logs = useMemo(
    () =>
      interactions
        // Older logs may lack the id; fall back to the "taken by" name.
        .filter((log) => (log.takenByInstructorId ? log.takenByInstructorId === instructor.id : instructorNamesMatch(log.instructorName, instructor.name)))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [interactions, instructor]
  );

  // The summary counts follow the date range; the search box narrows the list only.
  const range = useDateRange();
  const { hasRange, label: rangeLabel } = range;
  const inRange = logs.filter((log) => range.includes(log.date));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inRange;
    return inRange.filter((log) => [log.studentName, log.studentId, formatLogTopics(log)].some((v) => (v || '').toLowerCase().includes(q)));
  }, [inRange, search]);

  const studentCount = new Set(inRange.map((log) => log.studentId)).size;

  // Every interaction opens collapsed (header only); click a header to read its details.
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const toggleCard = (id: string) => setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));
  const allOpen = visible.length > 0 && visible.every((log) => openCards[log.id]);
  const setAllCards = (open: boolean) => setOpenCards(open ? Object.fromEntries(visible.map((log) => [log.id, true])) : {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative my-8 w-full max-w-3xl overflow-hidden rounded-xl bg-[#22272e] text-[#cdd9e5] shadow-2xl ring-1 ring-white/5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#373e47] bg-[#1c2128] px-6 py-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight">{instructor.name}</h2>
              <span className="rounded border border-[#373e47] bg-[#2d333b] px-1.5 py-0.5 font-mono text-[11px] text-[#909dab]">{instructor.id}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#909dab]">
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />Shown as <strong className="font-medium text-[#cdd9e5]">{instructor.firstName}</strong></span>
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{instructor.email}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#373e47] bg-[#2d333b] text-[#909dab] hover:bg-[#373e47] hover:text-[#cdd9e5] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 divide-x divide-[#373e47] border-b border-[#373e47]">
          <Stat label="Interactions taken" value={inRange.length} />
          <Stat label="Students evaluated" value={studentCount} />
          <Stat label="Last interaction" value={<span className="font-mono text-[13px]">{inRange[0]?.date ?? '—'}</span>} />
        </div>

        {logs.length > 0 && (
          <div className="space-y-2 border-b border-[#373e47] px-6 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#768390]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by student name, roll ID or topic..."
                  className="h-8 w-full rounded-md border border-[#373e47] bg-[#1c2128] pl-8 pr-3 text-xs text-[#cdd9e5] placeholder:text-[#768390] focus:border-[#545d68] focus:outline-hidden"
                />
              </div>
              <DateRangeFilter range={range} idPrefix="ih" />
            </div>
            {hasRange && (
              <p className="text-[11px] text-[#909dab]">
                Showing <span className="font-mono text-[#cdd9e5]">{inRange.length}</span> of {logs.length} interactions, {rangeLabel}.
              </p>
            )}
          </div>
        )}

        {/* Expand / collapse every card, just above the list (stays put while the list scrolls) */}
        {visible.length > 0 && (
          <div className="flex justify-end px-6 pt-4">
            <button
              type="button"
              onClick={() => setAllCards(!allOpen)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#373e47] bg-[#2d333b] px-2.5 text-[11px] font-medium text-[#adbac7] hover:bg-[#373e47] hover:text-[#cdd9e5] transition-colors cursor-pointer"
            >
              {allOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
        )}

        {/* Interactions, latest first */}
        <div className={`max-h-[60vh] overflow-y-auto px-6 pb-5 ${visible.length > 0 ? 'pt-3' : 'pt-5'}`}>
          {logs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#545d68] p-10 text-center">
              <Clock className="mx-auto mb-2 h-6 w-6 text-[#768390]" />
              <p className="text-sm font-medium text-[#adbac7]">No interactions taken yet</p>
            </div>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#909dab]">
              {inRange.length === 0 ? `No interactions taken ${rangeLabel}.` : <>No interaction {hasRange ? `${rangeLabel} ` : ''}matches &quot;{search}&quot;.</>}
            </p>
          ) : (
            <ol className="space-y-4">
              {visible.map((log) => {
                const cardOpen = !!openCards[log.id];
                return (
                <li key={log.id} className="rounded-lg border border-[#373e47] bg-[#2d333b]">
                  <div className={`flex items-start justify-between gap-4 px-4 py-3 ${cardOpen ? 'border-b border-[#373e47]' : ''}`}>
                    <button
                      type="button"
                      onClick={() => toggleCard(log.id)}
                      aria-expanded={cardOpen}
                      title={cardOpen ? 'Hide details' : 'Show details'}
                      className="min-w-0 flex-1 text-left cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-[#545d68]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {cardOpen ? <ChevronUp className="h-3.5 w-3.5 text-[#909dab]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#909dab]" />}
                        <span className="text-xs font-semibold text-[#cdd9e5]">{log.studentName}</span>
                        <span className="font-mono text-[11px] text-[#909dab]">{log.studentId}</span>
                        <StatusBadge status={log.statusPostInteraction} />
                      </div>
                      <div className="mt-1 text-[13px] font-medium text-[#cdd9e5]">{formatLogTopics(log)}</div>
                      <div className="mt-0.5 text-[11px] text-[#909dab]">
                        <span className="font-mono">{log.date}</span>
                        {log.level && <> • {log.level}</>}
                        {log.assignedInstructorName && !instructorNamesMatch(log.assignedInstructorName, instructor.name) && (
                          <> • Assigned to <span className="font-medium text-[#adbac7]">{log.assignedInstructorName}</span></>
                        )}
                        {log.updatedAt && <span title={`Edited ${new Date(log.updatedAt).toLocaleString()}`}> • edited</span>}
                      </div>
                    </button>
                    <div className="shrink-0 rounded-md bg-[#1c2128] px-2.5 py-1.5 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-[#768390]">Rating</div>
                      <div className="font-mono text-sm font-semibold text-[#cdd9e5]">{log.rating}<span className="text-[#768390]">/5</span></div>
                    </div>
                  </div>

                  {cardOpen && (<>
                  <dl className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-2">
                    {log.questionsAsked && <div className="md:col-span-2"><Field label="Questions asked" tone="questions" mono>{log.questionsAsked}</Field></div>}
                    {log.remarks && <Field label="Remarks" tone="remarks">{log.remarks}</Field>}
                    {log.performedWell && <Field label="Performed well" tone="performed">{log.performedWell}</Field>}
                    {log.improvementAreas && <Field label="Improvement areas" tone="improvement">{log.improvementAreas}</Field>}
                    {log.actionItems && <Field label="Action items" tone="actions">{log.actionItems}</Field>}
                  </dl>

                  {log.meetRecording && (
                    <div className="border-t border-[#373e47] px-4 py-2.5">
                      <a
                        href={log.meetRecording}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#adbac7] hover:text-[#cdd9e5] hover:underline underline-offset-2"
                      >
                        Open interaction cell in sheet <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  </>)}
                </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
