'use client';

import React, { useState } from 'react';
import { InteractionLog } from '@/lib/types';
import { todayLocal } from '@/lib/dates';
import { 
  Search, 
  Download, 
  ExternalLink, 
  X, 
  Eye,
  Pencil,
  Trash2,
  FileSpreadsheet
} from 'lucide-react';

interface InteractionLogsTableProps {
  interactions: InteractionLog[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onExportCSV: () => void;
  currentInstructor: string;
  canEdit?: (log: InteractionLog) => boolean;
  onEdit?: (log: InteractionLog) => void;
  onDelete?: (log: InteractionLog) => void; // same permission as editing
}

export function InteractionLogsTable({
  interactions,
  selectedDate,
  onDateChange,
  onExportCSV,
  canEdit = () => false,
  onEdit,
  onDelete
}: InteractionLogsTableProps) {
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<InteractionLog | null>(null);

  const filtered = interactions.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.instructorName.toLowerCase().includes(q) ||
      (log.assignedInstructorName || '').toLowerCase().includes(q) ||
      log.studentName.toLowerCase().includes(q) ||
      log.studentId.toLowerCase().includes(q) ||
      log.topics.toLowerCase().includes(q) ||
      log.statusPostInteraction.toLowerCase().includes(q) ||
      log.remarks.toLowerCase().includes(q)
    );
  });

  const isToday = selectedDate === todayLocal();

  return (
    <div className="space-y-4">
      {/* Top Banner - Linear utilitarian header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {isToday ? "Today's Interactions" : `Interactions for ${selectedDate}`}
            </h2>
            <span className="font-mono text-xs text-zinc-500">
              ({selectedDate} • {interactions.length} {interactions.length === 1 ? 'record' : 'records'})
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {isToday ? "Interactions taken today by all instructors. Earlier sessions are in each student's history." : "All recorded interactions for the selected date."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <span>Date</span>
            <input
              type="date"
              value={selectedDate}
              max={todayLocal()}
              onChange={(e) => onDateChange(e.target.value)}
              className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-800 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          <button
            onClick={onExportCSV}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>{isToday ? 'Export Today (CSV)' : `Export ${selectedDate} (CSV)`}</span>
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
        <input
          type="text"
          placeholder="Filter logs by instructor, student, topics, or remarks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 transition-colors"
        />
      </div>

      {/* Log Table - High density */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/60 font-medium text-zinc-500 dark:text-zinc-400">
                <th className="py-2.5 pl-4 pr-3">Candidate</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Assigned Instructor</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Taken By</th>
                <th className="py-2.5 px-3">Topics Covered</th>
                <th className="py-2.5 px-3">Status Post Interaction</th>
                <th className="py-2.5 px-3 text-center">Rating</th>
                <th className="py-2.5 px-3">Remarks</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 pl-3 pr-4 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
              {filtered.map((log) => {
                const isCleared = log.statusPostInteraction.includes('Cleared');
                const isRevisit = log.statusPostInteraction.includes('Revisit');

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {log.studentName}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400">
                        {log.studentId}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">
                      {log.assignedInstructorName || '—'}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{log.instructorName}</span>
                      {log.updatedAt && <span className="ml-1.5 rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" title={`Edited ${new Date(log.updatedAt).toLocaleString()}`}>edited</span>}
                    </td>

                    <td className="py-2.5 px-3 max-w-[140px] truncate text-zinc-700 dark:text-zinc-300">
                      {log.topics}
                    </td>

                    <td className="py-2.5 px-3">
                      {isCleared ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Cleared
                        </span>
                      ) : isRevisit ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Need to Revisit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                          {log.statusPostInteraction}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {log.rating}/5
                    </td>

                    <td className="py-2.5 px-3 max-w-[200px] truncate text-zinc-500 dark:text-zinc-400">
                      {log.remarks}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                      {log.date}
                    </td>

                    <td className="py-2.5 pl-3 pr-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center justify-center h-7 px-2 rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Eye className="h-3 w-3 mr-1 text-zinc-400" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-zinc-500">
                    {interactions.length === 0 ? `No interactions found for ${selectedDate}.` : 'No matching logs found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Inspection Dialog */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-2xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-lg bg-white border border-zinc-200 shadow-xl p-6 dark:bg-zinc-900 dark:border-zinc-800 transition-colors my-8">
            <div className="flex items-start justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Interaction Evaluation Record
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                  <span>Candidate: <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{selectedLog.studentName}</strong> ({selectedLog.studentId})</span>
                  <span>•</span>
                  <span className="font-mono">{selectedLog.date}</span>
                  {selectedLog.updatedAt && <><span>•</span><span>edited {new Date(selectedLog.updatedAt).toLocaleString()}</span></>}
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="h-7 w-7 rounded-md border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-[70vh] overflow-y-auto pr-1 text-xs">
              {/* Every field the instructor filled in. Empty text fields show "Not filled". */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {[
                  ['Assigned Instructor', selectedLog.assignedInstructorName || '—'],
                  ['Interaction Taken By', selectedLog.instructorName || '—'],
                  ['Interaction Date', selectedLog.date],
                  ['Status', selectedLog.statusPostInteraction],
                  ['Rating', `${selectedLog.rating} / 5`],
                  ['Level, Subtopic & Step (when logged)', [selectedLog.level, selectedLog.currentSubtopic, selectedLog.currentStep].filter(Boolean).join(' • ') || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <span className="mb-1 block text-[11px] font-medium text-zinc-500">{label}</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
                  </div>
                ))}
              </div>

              {([
                ['Topics', selectedLog.topics, false],
                ['Questions Asked', selectedLog.questionsAsked, true],
                ['Remarks by Instructor', selectedLog.remarks, false],
                ['Performed Well', selectedLog.performedWell, false],
                ['Improvement Areas', selectedLog.improvementAreas, false],
                ['Tweaked Questions Asked', selectedLog.tweakedQuestions, true],
                ['Action Items', selectedLog.actionItems, false],
              ] as const).map(([label, value, mono]) => (
                <div key={label} className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <span className="mb-1 block text-[11px] font-medium text-zinc-500">{label}</span>
                  <p className={`whitespace-pre-line leading-relaxed ${value ? 'text-zinc-800 dark:text-zinc-200' : 'italic text-zinc-400'} ${mono && value ? 'font-mono text-[11px]' : ''}`}>
                    {value || 'Not filled'}
                  </p>
                </div>
              ))}

              <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                <span className="mb-1 block text-[11px] font-medium text-zinc-500">Interaction Cell Link (from sheet)</span>
                {selectedLog.meetRecording ? (
                  <a href={selectedLog.meetRecording} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                    {selectedLog.meetRecording}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <p className="italic text-zinc-400">Not filled</p>
                )}
              </div>

              {selectedLog.granolaTranscript && (
                <div className="rounded-md border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
                  <span className="text-[11px] font-medium text-zinc-500 block mb-1">Raw Transcript</span>
                  <div className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 max-h-40 overflow-y-auto whitespace-pre-line">
                    {selectedLog.granolaTranscript}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              {onDelete && canEdit(selectedLog) && (
                <button
                  onClick={() => { const log = selectedLog; setSelectedLog(null); onDelete(log); }}
                  className="mr-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-zinc-900 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete interaction
                </button>
              )}
              {onEdit && canEdit(selectedLog) && (
                <button
                  onClick={() => { const log = selectedLog; setSelectedLog(null); onEdit(log); }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit interaction
                </button>
              )}
              <button
                onClick={() => setSelectedLog(null)}
                className="h-8 px-3 rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
