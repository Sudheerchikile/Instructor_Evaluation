'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Loader2, Search, UserCheck, UserPlus, X } from 'lucide-react';
import { InstructorChange } from '@/lib/types';
import { fetchInstructorChanges } from '@/lib/api';
import { DateRangeFilter, useDateRange } from '@/components/DateRangeFilter';

interface InstructorChangesModalProps {
  onClose: () => void;
}

const IST = 'Asia/Kolkata';
const istDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: IST }); // YYYY-MM-DD
const istDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Admin view: who added which instructor and who moved which students (admins and senior instructors), newest first.
export function InstructorChangesModal({ onClose }: InstructorChangesModalProps) {
  const [changes, setChanges] = useState<InstructorChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const range = useDateRange();

  useEffect(() => {
    fetchInstructorChanges().then(setChanges).catch((err: Error) => setError(err.message));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (changes ?? []).filter((c) => {
      if (!range.includes(istDate(c.createdAt))) return false;
      if (!q) return true;
      return [c.actorName, c.instructorName, c.instructorId, ...c.students.flatMap((s) => [s.id, s.name, s.fromName ?? ''])]
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [changes, search, range]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative my-8 w-full max-w-3xl overflow-hidden rounded-xl bg-[#22272e] text-[#cdd9e5] shadow-2xl ring-1 ring-white/5">
        <div className="flex items-start justify-between gap-4 border-b border-[#373e47] bg-[#1c2128] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Change history</h2>
            <p className="mt-1 text-xs text-[#909dab]">Every instructor added and every student assignment, with who made it. Times are IST.</p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#373e47] bg-[#2d333b] text-[#909dab] hover:bg-[#373e47] hover:text-[#cdd9e5] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {changes && changes.length > 0 && (
          <div className="space-y-2 border-b border-[#373e47] px-6 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#768390]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by who, instructor, student or roll number..."
                  className="h-8 w-full rounded-md border border-[#373e47] bg-[#1c2128] pl-8 pr-3 text-xs text-[#cdd9e5] placeholder:text-[#768390] focus:border-[#545d68] focus:outline-hidden"
                />
              </div>
              <DateRangeFilter range={range} idPrefix="ch" />
            </div>
            <p className="text-[11px] text-[#909dab]">
              Showing <span className="font-mono text-[#cdd9e5]">{visible.length}</span> of {changes.length} changes{range.hasRange ? `, ${range.label}` : ''}.
            </p>
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {error ? (
            <p className="text-xs text-red-400">Could not load the change history: {error}</p>
          ) : !changes ? (
            <div className="flex items-center gap-2 text-xs text-[#909dab]"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
          ) : changes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#545d68] p-10 text-center">
              <Clock className="mx-auto mb-2 h-6 w-6 text-[#768390]" />
              <p className="text-sm font-medium text-[#adbac7]">No changes recorded yet</p>
              <p className="mt-1 text-xs text-[#909dab]">Adding an instructor or assigning students will show up here.</p>
            </div>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#909dab]">No change matches the filters.</p>
          ) : (
            <ol className="space-y-3">
              {visible.map((c) => {
                const cardOpen = !!open[c.id];
                const n = c.students.length;
                const Icon = c.action === 'add_instructor' ? UserPlus : UserCheck;
                return (
                  <li key={c.id} className="rounded-lg border border-[#373e47] bg-[#2d333b]">
                    <button
                      type="button"
                      onClick={() => setOpen((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                      aria-expanded={cardOpen}
                      disabled={n === 0}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left ${n ? 'cursor-pointer' : 'cursor-default'} ${cardOpen ? 'border-b border-[#373e47]' : ''}`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#909dab]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-[#cdd9e5]">
                          <span className="font-semibold">{c.actorName}</span>
                          <span className="ml-1.5 rounded border border-[#373e47] bg-[#1c2128] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#909dab]">
                            {c.actorRole === 'admin' ? 'Admin' : 'Senior'}
                          </span>{' '}
                          {c.action === 'add_instructor' ? (
                            <>added instructor <span className="font-semibold">{c.instructorName}</span> ({c.instructorId}){n ? ` with ${n} student${n === 1 ? '' : 's'}` : ''}</>
                          ) : (
                            <>assigned {n} student{n === 1 ? '' : 's'} to <span className="font-semibold">{c.instructorName}</span></>
                          )}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-[#909dab]">{istDateTime(c.createdAt)}</div>
                      </div>
                      {n > 0 && (cardOpen ? <ChevronUp className="mt-0.5 h-3.5 w-3.5 text-[#909dab]" /> : <ChevronDown className="mt-0.5 h-3.5 w-3.5 text-[#909dab]" />)}
                    </button>
                    {cardOpen && (
                      <table className="w-full text-[11px]">
                        <thead className="text-[#768390]">
                          <tr>
                            <th className="py-1.5 pl-4 pr-3 text-left font-medium">Student</th>
                            <th className="py-1.5 px-3 text-left font-medium">Roll number</th>
                            <th className="py-1.5 pl-3 pr-4 text-left font-medium">Moved from</th>
                          </tr>
                        </thead>
                        <tbody className="text-[#adbac7]">
                          {c.students.map((s) => (
                            <tr key={s.id} className="border-t border-[#373e47]/60">
                              <td className="py-1.5 pl-4 pr-3 text-[#cdd9e5]">{s.name}</td>
                              <td className="py-1.5 px-3 font-mono">{s.id}</td>
                              <td className="py-1.5 pl-3 pr-4">{s.fromName ?? <span className="text-[#768390]">No instructor</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
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
