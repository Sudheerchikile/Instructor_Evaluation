'use client';

import React, { useState } from 'react';
import { InteractionLog } from '@/lib/types';
import { 
  Search, 
  Download, 
  ExternalLink, 
  X, 
  Eye,
  FileSpreadsheet
} from 'lucide-react';

interface InteractionLogsTableProps {
  interactions: InteractionLog[];
  onExportCSV: () => void;
  currentInstructor: string;
}

export function InteractionLogsTable({
  interactions,
  onExportCSV
}: InteractionLogsTableProps) {
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<InteractionLog | null>(null);

  const filtered = interactions.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.instructorName.toLowerCase().includes(q) ||
      log.studentName.toLowerCase().includes(q) ||
      log.studentId.toLowerCase().includes(q) ||
      log.topics.toLowerCase().includes(q) ||
      log.statusPostInteraction.toLowerCase().includes(q) ||
      log.remarks.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Banner - Linear utilitarian header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Evaluation & Interaction Logs (Sheet 2 Schema)
            </h2>
            <span className="font-mono text-xs text-zinc-500">
              ({interactions.length} records)
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Synchronized records matching the 12-column Google Spreadsheet evaluation schema.
          </p>
        </div>

        <button
          onClick={onExportCSV}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Export All Logs (CSV)</span>
        </button>
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
                <th className="py-2.5 pl-4 pr-3">Instructor</th>
                <th className="py-2.5 px-3">Candidate</th>
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
                    <td className="py-2.5 pl-4 pr-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {log.instructorName}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {log.studentName}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400">
                        {log.studentId}
                      </div>
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
                  <td colSpan={8} className="py-12 text-center text-xs text-zinc-500">
                    No matching logs found.
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
                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                  <span>Candidate: <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{selectedLog.studentName}</strong> ({selectedLog.studentId})</span>
                  <span>•</span>
                  <span>Evaluator: <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{selectedLog.instructorName}</strong></span>
                  <span>•</span>
                  <span className="font-mono">{selectedLog.date}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="h-7 w-7 rounded-md border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <span className="text-[11px] font-medium text-zinc-500 block mb-1">Topics</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{selectedLog.topics}</span>
                </div>

                <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <span className="text-[11px] font-medium text-zinc-500 block mb-1">Status & Score</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{selectedLog.statusPostInteraction}</span>
                    <span className="font-mono text-zinc-500">({selectedLog.rating}/5)</span>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                <span className="text-[11px] font-medium text-zinc-500 block mb-1">Questions Asked</span>
                <p className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-relaxed">
                  {selectedLog.questionsAsked || 'None logged'}
                </p>
              </div>

              <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                <span className="text-[11px] font-medium text-zinc-500 block mb-1">Instructor Remarks</span>
                <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-relaxed">
                  {selectedLog.remarks || 'None logged'}
                </p>
              </div>

              {selectedLog.performedWell && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-400 block mb-1">Performed Well</span>
                  <p className="text-emerald-950 dark:text-emerald-200 whitespace-pre-line leading-relaxed">
                    {selectedLog.performedWell}
                  </p>
                </div>
              )}

              {selectedLog.actionItems && (
                <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <span className="text-[11px] font-medium text-zinc-500 block mb-1">Action Items</span>
                  <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-relaxed">
                    {selectedLog.actionItems}
                  </p>
                </div>
              )}

              {selectedLog.meetRecording && (
                <div className="pt-1">
                  <a
                    href={selectedLog.meetRecording}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    <span>Open Meet Recording</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {selectedLog.granolaTranscript && (
                <div className="rounded-md border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
                  <span className="text-[11px] font-medium text-zinc-500 block mb-1">Raw Transcript</span>
                  <div className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 max-h-40 overflow-y-auto whitespace-pre-line">
                    {selectedLog.granolaTranscript}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end border-t border-zinc-200 pt-3 dark:border-zinc-800">
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
