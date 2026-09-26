'use client';

import React, { useState } from 'react';
import { Student, InteractionLog } from '@/lib/types';
import { 
  X, 
  ExternalLink, 
  Play, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  User, 
  GraduationCap,
  Building,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface StudentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  interactions: InteractionLog[];
  onStartNewInteraction: (student: Student) => void;
}

export function StudentHistoryModal({
  isOpen,
  onClose,
  student,
  interactions,
  onStartNewInteraction
}: StudentHistoryModalProps) {
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});

  if (!isOpen || !student) return null;

  const studentInteractions = interactions.filter((i) => i.studentId === student.id);

  const toggleTranscript = (id: string) => {
    setExpandedTranscripts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900 border border-white/[0.08] shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.08] bg-slate-950/80 p-6 backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {student.name}
              </h2>
              <span className="font-mono text-xs rounded-md border border-white/[0.08] bg-slate-950 px-2 py-0.5 text-cyan-300">
                {student.id}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-semibold text-slate-200">
                <GraduationCap className="h-3.5 w-3.5 text-cyan-400" />
                {student.degree} • {student.section}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-slate-200">
                <Building className="h-3.5 w-3.5 text-slate-500" />
                {student.hall}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-slate-500" />
                Instructor: <strong className="text-slate-200">{student.instructor}</strong>
              </span>
              <span>•</span>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 font-bold text-cyan-300">
                {student.level}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onStartNewInteraction(student);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-400 hover:to-cyan-400 transition-all cursor-pointer"
            >
              <Play className="h-3 w-3 fill-white" />
              <span>Evaluate</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-slate-950 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Timeline body */}
        <div className="p-6 max-h-[72vh] overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Interaction Timeline ({studentInteractions.length} Sessions)
            </h3>
            <span className="text-xs text-slate-500">
              Level 0 requires 2 validated interactions
            </span>
          </div>

          {studentInteractions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.1] bg-slate-950/40 p-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">
                No interactions logged yet
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Click &quot;Evaluate&quot; to begin Round 1 evaluation with {student.name}.
              </p>
            </div>
          ) : (
            studentInteractions.map((log) => {
              const isRevisit = log.statusPostInteraction.includes('Revisit');
              const isCleared = log.statusPostInteraction.includes('Cleared');
              const isExpanded = expandedTranscripts[log.id];

              return (
                <div
                  key={log.id}
                  className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5 space-y-3 backdrop-blur-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-white/[0.08] bg-slate-900 px-2 py-0.5 text-xs font-bold text-slate-200">
                          Round {log.interactionRound || 1}
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          {log.topics}
                        </h4>
                        {isRevisit ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                            <AlertCircle className="h-3 w-3" />
                            Needs Revisit
                          </span>
                        ) : isCleared ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Cleared
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300">
                            {log.statusPostInteraction}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                        <span>Instructor: <strong className="text-slate-200">{log.instructorName}</strong></span>
                        <span>•</span>
                        <span className="font-mono">{log.date}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Rating</span>
                      <span className="font-mono text-base font-bold text-cyan-400">
                        {log.rating} / 5
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="rounded-xl border border-white/[0.04] bg-slate-900/60 p-3">
                      <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                        Questions Asked:
                      </span>
                      <p className="font-mono text-[11px] text-slate-300 whitespace-pre-line leading-relaxed">
                        {log.questionsAsked}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.04] bg-slate-900/60 p-3">
                      <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                        Remarks & Observations:
                      </span>
                      <p className="text-[11px] text-slate-300 whitespace-pre-line leading-relaxed">
                        {log.remarks}
                      </p>
                    </div>
                  </div>

                  {log.performedWell && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs">
                      <span className="text-[10px] font-semibold uppercase text-emerald-400 block mb-1">
                        Performed Well:
                      </span>
                      <p className="text-[11px] text-emerald-200 whitespace-pre-line">
                        {log.performedWell}
                      </p>
                    </div>
                  )}

                  {log.actionItems && (
                    <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3 text-xs">
                      <span className="text-[10px] font-semibold uppercase text-indigo-400 block mb-1">
                        Action Items:
                      </span>
                      <p className="text-[11px] text-indigo-200 whitespace-pre-line">
                        {log.actionItems}
                      </p>
                    </div>
                  )}

                  {/* Transcript accordion */}
                  {log.granolaTranscript && (
                    <div className="border-t border-white/[0.06] pt-2">
                      <button
                        onClick={() => toggleTranscript(log.id)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>{isExpanded ? 'Hide Raw Granola Transcript' : 'View Raw Granola Transcript'}</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 rounded-xl border border-purple-500/20 bg-purple-950/20 p-3 font-mono text-[10px] text-purple-200 max-h-48 overflow-y-auto whitespace-pre-line">
                          {log.granolaTranscript}
                        </div>
                      )}
                    </div>
                  )}

                  {log.meetRecording && (
                    <div className="pt-1">
                      <a
                        href={log.meetRecording}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline font-mono"
                      >
                        <span>Open Meet Recording</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
