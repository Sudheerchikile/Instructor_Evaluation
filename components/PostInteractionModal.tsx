'use client';

import React, { useState } from 'react';
import { Student, InteractionLog, InstructorOption } from '@/lib/types';
import { todayLocal } from '@/lib/dates';
import { X, Save } from 'lucide-react';
import { InstructorPicker } from '@/components/InstructorPicker';

interface PostInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  currentInstructorId?: string | null;
  instructorOptions: InstructorOption[];
  initialDraft?: {
    round: number;
    selectedTopics: string;
    questionsAskedList: string[];
    notes: string;
  } | null;
  onSave: (log: InteractionLog) => void;
}

// Rendered only while a student is selected (see app/page.tsx), so every open starts from fresh state.
export function PostInteractionModal({
  isOpen,
  onClose,
  student,
  currentInstructorId,
  instructorOptions,
  initialDraft,
  onSave
}: PostInteractionModalProps) {
  // Student and assigned instructor come from the selected student; the date defaults to today but stays editable.
  const [interactionDate, setInteractionDate] = useState(todayLocal);
  const studentName = student?.name ?? '';
  const assignedInstructorName = student?.instructorFullName || student?.instructor || '';
  // Defaults to the signed-in instructor; may be changed to the colleague who took the session.
  const [takenById, setTakenById] = useState<string | null>(currentInstructorId ?? null);
  const [takenByError, setTakenByError] = useState(false);
  const [topics, setTopics] = useState('');
  const [statusPostInteraction, setStatusPostInteraction] = useState<'Need to Revisit' | 'Cleared' | 'In Progress'>('Need to Revisit');
  const [rating, setRating] = useState<number>(0);
  const [questionsAsked, setQuestionsAsked] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [performedWell, setPerformedWell] = useState<string>('');
  const [improvementAreas, setImprovementAreas] = useState<string>('');
  const [tweakedQuestions, setTweakedQuestions] = useState<string>('');
  const [actionItems, setActionItems] = useState<string>('');
  const [meetRecording, setMeetRecording] = useState<string>('');

  const [interactionRound] = useState(initialDraft?.round || 1);

  if (!isOpen || !student) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const takenBy = instructorOptions.find((o) => o.id === takenById);
    if (!takenBy) {
      setTakenByError(true);
      return;
    }

    const log: InteractionLog = {
      id: `int-${Date.now()}`,
      studentId: student.id,
      studentName,
      instructorName: takenBy.name,
      takenByInstructorId: takenBy.id,
      assignedInstructorName,
      topics,
      statusPostInteraction,
      rating,
      questionsAsked,
      remarks,
      performedWell,
      improvementAreas,
      tweakedQuestions,
      actionItems,
      meetRecording,
      granolaTranscript: '',
      interactionRound,
      level: student.level,
      currentStep: student.currentStep,
      date: interactionDate || todayLocal(),
      createdAt: new Date().toISOString()
    };

    onSave(log);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-2xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-lg bg-white border border-zinc-200 shadow-xl my-8 overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3.5 dark:border-zinc-800">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Record Evaluation Session
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Candidate: <strong className="text-zinc-800 dark:text-zinc-200">{student.name}</strong> ({student.id} • {student.level} • {student.hall})
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs">
          {/* Form Fields: Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={interactionDate}
                onChange={(e) => setInteractionDate(e.target.value)}
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Student Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                readOnly
                value={studentName}
                className="h-8 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Assigned Instructor <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                readOnly
                value={assignedInstructorName}
                className="h-8 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Interaction Taken By <span className="text-rose-500">*</span>
              </label>
              <InstructorPicker
                options={instructorOptions}
                value={takenById}
                loading={instructorOptions.length === 0}
                onChange={(id) => { setTakenById(id); setTakenByError(false); }}
              />
              {takenByError && <p className="mt-1 text-[11px] text-rose-500">Select who took this interaction.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Topics <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="e.g. 1.1 Data Types"
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Form Fields: Row 2 Status & Rating */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Status Post Interaction <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'Need to Revisit', label: 'Need to Revisit', dot: 'bg-amber-500' },
                  { id: 'Cleared', label: 'Cleared', dot: 'bg-emerald-500' },
                  { id: 'In Progress', label: 'In Progress', dot: 'bg-zinc-400' }
                ].map((s) => {
                  const isSelected = statusPostInteraction === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStatusPostInteraction(s.id as typeof statusPostInteraction)}
                      className={`h-8 rounded-md border flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-current' : s.dot}`} />
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Rating Based on Interaction (step wise rating out of 5)
              </label>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((num) => {
                  const isSelected = rating === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRating(num)}
                      className={`h-8 flex-1 rounded-md border font-mono font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Questions Asked & Remarks */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Questions Asked During Interaction <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={questionsAsked}
                onChange={(e) => setQuestionsAsked(e.target.value)}
                placeholder="1) Declare a variable in C++ / size of int&#10;2) How to take input & print output (a+b)..."
                className="w-full rounded-md border border-zinc-200 bg-white p-2.5 font-mono text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Remarks by Instructor <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="1) Knows int vs long long distinction, but struggles with implementation.&#10;2) Got stuck explaining range/constraint handling..."
                className="w-full rounded-md border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Performed Well & Improvement Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Performed Well (Concepts/Topics)
              </label>
              <textarea
                rows={2}
                value={performedWell}
                onChange={(e) => setPerformedWell(e.target.value)}
                placeholder="1) Correct I/O syntax&#10;2) Understood float vs double"
                className="w-full rounded-md border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Improvement Areas
              </label>
              <textarea
                rows={2}
                value={improvementAreas}
                onChange={(e) => setImprovementAreas(e.target.value)}
                placeholder="ASCII character arithmetic, 10^6 integer constraints"
                className="w-full rounded-md border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Tweaked Questions & Action Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Tweaked Questions Asked
              </label>
              <input
                type="text"
                value={tweakedQuestions}
                onChange={(e) => setTweakedQuestions(e.target.value)}
                placeholder="Any customized variant problems posed"
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Action Items
              </label>
              <input
                type="text"
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="1) Practice implementation problems across all Level-0 topics"
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Meet Recording URL */}
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Meet Recording
            </label>
            <input
              type="url"
              value={meetRecording}
              onChange={(e) => setMeetRecording(e.target.value)}
              placeholder="https://notes.granola.ai/t/..."
              className="h-8 w-full rounded-md border border-zinc-200 bg-white px-3 font-mono text-[11px] text-zinc-900 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>


          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium cursor-pointer shadow-xs"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Interaction</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
