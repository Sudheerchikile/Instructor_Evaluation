'use client';

import React, { useMemo, useState } from 'react';
import { Student, InteractionLog } from '@/lib/types';
import {
  X,
  ExternalLink,
  Play,
  Clock,
  User,
  GraduationCap,
  Building,
  FileText,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MessageSquare,
  ThumbsUp,
  TrendingUp,
  ListChecks
} from 'lucide-react';

interface StudentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  interactions: InteractionLog[];
  onStartNewInteraction: (student: Student) => void;
  canLogInteraction?: boolean;
}

// Dimmed-grey reading panel (low glare for long review sessions), deliberately different from the
// near-black dashboard behind it. Palette: #1c2128 / #22272e / #2d333b surfaces, #373e47 borders.

function StatusBadge({ status }: { status: string }) {
  const dot = status.includes('Revisit') ? 'bg-amber-400' : status.includes('Cleared') ? 'bg-emerald-400' : 'bg-[#768390]';
  const label = status.includes('Revisit') ? 'Needs Revisit' : status;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#373e47] bg-[#2d333b] px-2 py-0.5 text-[11px] font-medium text-[#adbac7]">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// Each section gets its own block, a muted accent edge, icon and label colour so they don't blur together.
const FIELD_TONES = {
  questions:   { edge: 'border-l-[#768390]', label: 'text-[#adbac7]', Icon: HelpCircle },
  remarks:     { edge: 'border-l-[#539bf5]', label: 'text-[#6cb6ff]', Icon: MessageSquare },
  performed:   { edge: 'border-l-[#57ab5a]', label: 'text-[#6bc46d]', Icon: ThumbsUp },
  improvement: { edge: 'border-l-[#c69026]', label: 'text-[#daaa3f]', Icon: TrendingUp },
  actions:     { edge: 'border-l-[#986ee2]', label: 'text-[#b083f0]', Icon: ListChecks },
} as const;

function Field({ label, tone, children, mono = false }: { label: string; tone: keyof typeof FIELD_TONES; children: React.ReactNode; mono?: boolean }) {
  const { edge, label: labelColor, Icon } = FIELD_TONES[tone];
  return (
    <div className={`rounded-md border border-[#373e47] border-l-[3px] ${edge} bg-[#22272e] px-3.5 py-3`}>
      <dt className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${labelColor}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className={`mt-2 whitespace-pre-line text-[12px] leading-relaxed text-[#adbac7] ${mono ? 'font-mono text-[11px]' : ''}`}>
        {children}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-[11px] text-[#909dab]">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-[#cdd9e5]">{value}</div>
    </div>
  );
}

export function StudentHistoryModal({
  isOpen,
  onClose,
  student,
  interactions,
  onStartNewInteraction,
  canLogInteraction = false
}: StudentHistoryModalProps) {
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});

  // Latest first; "Interaction N" counts in the order they happened (oldest = 1).
  const timeline = useMemo(() => {
    if (!student) return [];
    const logs = interactions
      .filter((i) => i.studentId === student.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    return logs.map((log, index) => ({ log, number: logs.length - index }));
  }, [interactions, student]);

  if (!isOpen || !student) return null;

  const latest = timeline[0]?.log;
  const averageRating = timeline.length
    ? (timeline.reduce((sum, { log }) => sum + Number(log.rating || 0), 0) / timeline.length).toFixed(1)
    : null;

  const toggleTranscript = (id: string) => {
    setExpandedTranscripts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative my-8 w-full max-w-3xl overflow-hidden rounded-xl bg-[#22272e] text-[#cdd9e5] shadow-2xl ring-1 ring-white/5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#373e47] bg-[#1c2128] px-6 py-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight">{student.name}</h2>
              <span className="rounded border border-[#373e47] bg-[#2d333b] px-1.5 py-0.5 font-mono text-[11px] text-[#909dab]">{student.id}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#909dab]">
              <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{student.degree} • {student.section}</span>
              <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" />{student.hall}</span>
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />Instructor: <strong className="font-medium text-[#cdd9e5]">{student.instructor}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canLogInteraction && (
              <button
                onClick={() => {
                  onClose();
                  onStartNewInteraction(student);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#545d68] bg-[#373e47] px-3 text-xs font-medium text-[#cdd9e5] hover:bg-[#444c56] transition-colors cursor-pointer"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>Log Interaction</span>
              </button>
            )}
            <button
              onClick={onClose}
              title="Close"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#373e47] bg-[#2d333b] text-[#909dab] hover:bg-[#373e47] hover:text-[#cdd9e5] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 divide-x divide-[#373e47] border-b border-[#373e47] sm:grid-cols-4">
          <Stat label="Current level" value={student.level} />
          <Stat label="Interactions" value={timeline.length} />
          <Stat label="Last interaction" value={<span className="font-mono text-[13px]">{latest?.date ?? '—'}</span>} />
          <Stat label="Average rating" value={averageRating ? `${averageRating} / 5` : '—'} />
        </div>

        {/* Timeline */}
        <div className="max-h-[64vh] overflow-y-auto px-6 py-5">
          {timeline.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#545d68] p-10 text-center">
              <Clock className="mx-auto mb-2 h-6 w-6 text-[#768390]" />
              <p className="text-sm font-medium text-[#adbac7]">No interactions logged yet</p>
              {canLogInteraction && (
                <p className="mt-1 text-xs text-[#909dab]">Use &quot;Log Interaction&quot; to record the first session with {student.name}.</p>
              )}
            </div>
          ) : (
            <ol className="relative space-y-6">
              {/* vertical rail */}
              <span aria-hidden className="absolute left-3.25 top-2 bottom-2 w-px bg-[#373e47]" />
              {timeline.map(({ log, number }, index) => {
                const isLatest = index === 0;
                const isExpanded = expandedTranscripts[log.id];
                return (
                  <li key={log.id} className="relative pl-10">
                    <span
                      className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] font-semibold ${
                        isLatest ? 'bg-[#adbac7] text-[#22272e]' : 'border border-[#545d68] bg-[#2d333b] text-[#adbac7]'
                      }`}
                    >
                      {number}
                    </span>

                    <div className="rounded-lg border border-[#373e47] bg-[#2d333b]">
                      <div className="flex items-start justify-between gap-4 border-b border-[#373e47] px-4 py-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-[#cdd9e5]">Interaction {number}</span>
                            {isLatest && <span className="rounded bg-[#373e47] px-1.5 py-0.5 text-[10px] font-medium text-[#adbac7]">Latest</span>}
                            <StatusBadge status={log.statusPostInteraction} />
                          </div>
                          <div className="mt-1 text-[13px] font-medium text-[#cdd9e5]">{log.topics}</div>
                          <div className="mt-0.5 text-[11px] text-[#909dab]">
                            <span className="font-mono">{log.date}</span> • Taken by <span className="font-medium text-[#adbac7]">{log.instructorName}</span>
                          </div>
                        </div>
                        <div className="shrink-0 rounded-md bg-[#1c2128] px-2.5 py-1.5 text-center">
                          <div className="text-[10px] uppercase tracking-wide text-[#768390]">Rating</div>
                          <div className="font-mono text-sm font-semibold text-[#cdd9e5]">{log.rating}<span className="text-[#768390]">/5</span></div>
                        </div>
                      </div>

                      <dl className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-2">
                        {log.questionsAsked && <div className="md:col-span-2"><Field label="Questions asked" tone="questions" mono>{log.questionsAsked}</Field></div>}
                        {log.remarks && <Field label="Remarks" tone="remarks">{log.remarks}</Field>}
                        {log.performedWell && <Field label="Performed well" tone="performed">{log.performedWell}</Field>}
                        {log.improvementAreas && <Field label="Improvement areas" tone="improvement">{log.improvementAreas}</Field>}
                        {log.actionItems && <Field label="Action items" tone="actions">{log.actionItems}</Field>}
                      </dl>

                      {(log.meetRecording || log.granolaTranscript) && (
                        <div className="flex flex-wrap items-center gap-4 border-t border-[#373e47] px-4 py-2.5">
                          {log.meetRecording && (
                            <a
                              href={log.meetRecording}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#adbac7] hover:text-[#cdd9e5] hover:underline underline-offset-2"
                            >
                              Open meet recording <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {/* Older logs only; new logs no longer store a transcript */}
                          {log.granolaTranscript && (
                            <button
                              onClick={() => toggleTranscript(log.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#adbac7] hover:text-[#cdd9e5] cursor-pointer"
                            >
                              <FileText className="h-3 w-3" />
                              {isExpanded ? 'Hide transcript' : 'View transcript'}
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      )}
                      {isExpanded && log.granolaTranscript && (
                        <div className="mx-4 mb-4 max-h-48 overflow-y-auto whitespace-pre-line rounded-md bg-[#1c2128] p-3 font-mono text-[10px] text-[#adbac7]">
                          {log.granolaTranscript}
                        </div>
                      )}
                    </div>
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
