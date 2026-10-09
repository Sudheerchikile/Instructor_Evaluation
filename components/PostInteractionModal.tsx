'use client';

import React, { useEffect, useState } from 'react';
import { Student, InteractionLog, InstructorOption } from '@/lib/types';
import { todayLocal } from '@/lib/dates';
import { blockKeyboardSubmit } from '@/lib/forms';
import {
  InteractionDraftFields, clearInteractionDraft, interactionDraftKey, loadInteractionDraft, saveInteractionDraft,
} from '@/lib/interactionDraft';
import { SHEET_COLUMNS, SheetRowResult, parseSheetRow } from '@/lib/sheetRowParser';
import { instructorNamesMatch } from '@/lib/storage';
import { X, Save, RotateCcw, ClipboardPaste, CheckCircle2, AlertTriangle } from 'lucide-react';
import { InstructorPicker } from '@/components/InstructorPicker';
import { TopicMultiPicker } from '@/components/TopicMultiPicker';
import { getTopicOptions } from '@/lib/multiLevelCurriculum';

// Topics are stored as one comma-separated string (the DB column and CSV export stay unchanged).
const TOPIC_SEPARATOR = ', ';
const splitTopics = (value: string | undefined) => (value ?? '').split(',').map((t) => t.trim()).filter(Boolean);

interface PostInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  currentInstructorId?: string | null;
  draftOwnerId?: string | null; // signed-in user id; unsaved entries are kept as a draft under it
  instructorOptions: InstructorOption[];
  initialDraft?: {
    round: number;
    selectedTopics: string;
    questionsAskedList: string[];
    notes: string;
  } | null;
  onSave: (log: InteractionLog) => void;
  editing?: InteractionLog | null; // when set, the form edits this interaction instead of logging a new one
}

// Rendered only while a student is selected (see app/page.tsx), so every open starts from fresh state.
export function PostInteractionModal({
  isOpen,
  onClose,
  student,
  currentInstructorId,
  draftOwnerId,
  instructorOptions,
  initialDraft,
  onSave,
  editing = null
}: PostInteractionModalProps) {
  // Student and assigned instructor come from the selected student. The date starts empty on a new log so
  // the instructor must pick the day the session actually happened (a today default was often left unchanged).
  // When editing, every field starts from the saved interaction.
  const [defaults] = useState<InteractionDraftFields>(() => {
    const saved = editing?.statusPostInteraction;
    return {
      interactionDate: editing?.date ?? '',
      // New logs default to the signed-in instructor; may be changed to the colleague who took the session.
      takenById: editing ? editing.takenByInstructorId ?? null : currentInstructorId ?? null,
      topics: splitTopics(editing?.topics),
      statusPostInteraction: saved === 'Cleared' || saved === 'In Progress' || saved === 'Need to Revisit' ? saved : 'Need to Revisit',
      rating: editing ? Number(editing.rating) : 0,
      questionsAsked: editing?.questionsAsked ?? '',
      remarks: editing?.remarks ?? '',
      performedWell: editing?.performedWell ?? '',
      improvementAreas: editing?.improvementAreas ?? '',
      tweakedQuestions: editing?.tweakedQuestions ?? '',
      actionItems: editing?.actionItems ?? '',
      meetRecording: editing?.meetRecording ?? '',
    };
  });
  // Unsaved entries from an earlier open of this same form (reload, lost connection, closed by mistake).
  const draftKey = student && draftOwnerId ? interactionDraftKey(draftOwnerId, { studentId: student.id, editingId: editing?.id }) : null;
  const [restored, setRestored] = useState(() => (draftKey ? loadInteractionDraft(draftKey) : null));
  const initial = restored?.fields ?? defaults;

  const [interactionDate, setInteractionDate] = useState(initial.interactionDate);
  const [dateError, setDateError] = useState(false);
  const studentName = editing?.studentName ?? student?.name ?? '';
  const assignedInstructorName = editing?.assignedInstructorName || student?.instructorFullName || student?.instructor || '';
  const [takenById, setTakenById] = useState<string | null>(initial.takenById);
  const [takenByError, setTakenByError] = useState(false);
  const [topics, setTopics] = useState<string[]>(initial.topics);
  const [topicsError, setTopicsError] = useState(false);
  const [statusPostInteraction, setStatusPostInteraction] = useState<InteractionDraftFields['statusPostInteraction']>(initial.statusPostInteraction);
  const [rating, setRating] = useState<number>(initial.rating);
  const [questionsAsked, setQuestionsAsked] = useState<string>(initial.questionsAsked);
  const [remarks, setRemarks] = useState<string>(initial.remarks);
  const [performedWell, setPerformedWell] = useState<string>(initial.performedWell);
  const [improvementAreas, setImprovementAreas] = useState<string>(initial.improvementAreas);
  const [tweakedQuestions, setTweakedQuestions] = useState<string>(initial.tweakedQuestions);
  const [actionItems, setActionItems] = useState<string>(initial.actionItems);
  const [meetRecording, setMeetRecording] = useState<string>(initial.meetRecording);

  // Keep the draft in step with every change; a form still equal to its starting values stores nothing.
  const fields: InteractionDraftFields = {
    interactionDate, takenById, topics, statusPostInteraction, rating, questionsAsked, remarks,
    performedWell, improvementAreas, tweakedQuestions, actionItems, meetRecording,
  };
  const fieldsJson = JSON.stringify(fields);
  useEffect(() => {
    if (!draftKey) return;
    if (fieldsJson === JSON.stringify(defaults)) clearInteractionDraft(draftKey);
    else saveInteractionDraft(draftKey, JSON.parse(fieldsJson));
  }, [draftKey, fieldsJson, defaults]);

  const discardDraft = () => {
    setInteractionDate(defaults.interactionDate);
    setTakenById(defaults.takenById);
    setTopics(defaults.topics);
    setStatusPostInteraction(defaults.statusPostInteraction);
    setRating(defaults.rating);
    setQuestionsAsked(defaults.questionsAsked);
    setRemarks(defaults.remarks);
    setPerformedWell(defaults.performedWell);
    setImprovementAreas(defaults.improvementAreas);
    setTweakedQuestions(defaults.tweakedQuestions);
    setActionItems(defaults.actionItems);
    setMeetRecording(defaults.meetRecording);
    setRestored(null);
    if (draftKey) clearInteractionDraft(draftKey);
  };

  // "Paste from sheet": one row copied from the instructors' sheet fills the form. Empty cells don't wipe a field.
  const [sheetText, setSheetText] = useState('');
  const [sheetResult, setSheetResult] = useState<SheetRowResult | null>(null);
  const fillFromSheet = () => {
    if (!student) return;
    const result = parseSheetRow(sheetText, getTopicOptions((editing ? editing.level : student.level) ?? student.level), todayLocal());
    const v = result.values;
    if (v.takenByName) {
      const match = instructorOptions.find((o) => instructorNamesMatch(o.name, v.takenByName!) || instructorNamesMatch(o.firstName, v.takenByName!));
      if (match) { setTakenById(match.id); setTakenByError(false); }
      else {
        result.filled--;
        result.warnings.push(`Instructor "${v.takenByName}" is not in the instructor list. Pick Interaction Taken By by hand.`);
      }
    }
    if (v.date) { setInteractionDate(v.date); setDateError(false); }
    if (v.topics) { setTopics(v.topics); setTopicsError(false); }
    if (v.status) setStatusPostInteraction(v.status);
    if (v.rating !== undefined) setRating(v.rating);
    if (v.questionsAsked) setQuestionsAsked(v.questionsAsked);
    if (v.remarks) setRemarks(v.remarks);
    if (v.performedWell) setPerformedWell(v.performedWell);
    if (v.improvementAreas) setImprovementAreas(v.improvementAreas);
    if (v.tweakedQuestions) setTweakedQuestions(v.tweakedQuestions);
    if (v.actionItems) setActionItems(v.actionItems);
    if (v.meetRecording) setMeetRecording(v.meetRecording);
    setSheetResult(result);
    if (result.filled) setSheetText('');
  };

  const [interactionRound] = useState(initialDraft?.round || 1);

  if (!isOpen || !student) return null;

  // An edit offers the topics of the level the interaction was logged at.
  const topicOptions = getTopicOptions((editing ? editing.level : student.level) ?? student.level);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const takenBy = instructorOptions.find((o) => o.id === takenById);
    if (!interactionDate) setDateError(true);
    if (!takenBy) setTakenByError(true);
    if (topics.length === 0) setTopicsError(true);
    if (!interactionDate || !takenBy || topics.length === 0) return;

    const log: InteractionLog = {
      ...(editing ?? {}),
      id: editing?.id ?? `int-${Date.now()}`,
      studentId: student.id,
      studentName,
      instructorName: takenBy.name,
      takenByInstructorId: takenBy.id,
      assignedInstructorName,
      topics: topics.join(TOPIC_SEPARATOR),
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
      interactionRound: editing?.interactionRound ?? interactionRound,
      // An edit keeps the level/step snapshot and creation time of the original log.
      level: editing ? editing.level : student.level,
      currentStep: editing ? editing.currentStep : student.currentStep,
      currentSubtopic: editing ? editing.currentSubtopic ?? null : student.currentSubtopic ?? null,
      date: interactionDate,
      createdAt: editing?.createdAt ?? new Date().toISOString()
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
                {editing ? 'Edit Interaction' : 'Record Evaluation Session'}
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

        {/* Saved only by clicking the Save button: Enter/Space never submit this form. */}
        <form onSubmit={handleSubmit} onKeyDown={blockKeyboardSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs">
          {restored && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300">
              <span>
                Restored your unsaved entries from{' '}
                <strong className="font-medium">{new Date(restored.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>.
              </span>
              <button
                type="button"
                onClick={discardDraft}
                className="inline-flex shrink-0 items-center gap-1 font-medium hover:underline underline-offset-2 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                {editing ? 'Discard changes' : 'Start over'}
              </button>
            </div>
          )}

          {/* Paste from sheet */}
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-950/40">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="sheet-row" className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
                <ClipboardPaste className="h-3.5 w-3.5" />
                Paste from sheet
              </label>
              <span className="hidden text-[10px] text-zinc-400 sm:block" title={`Without a header row, columns are read in this order: ${SHEET_COLUMNS.join(' | ')}`}>
                Header row + one row, as a table or copied from the sheet
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <textarea
                id="sheet-row"
                rows={2}
                value={sheetText}
                onChange={(e) => setSheetText(e.target.value)}
                placeholder="| Date | Instructor's Name | Topics | Status Post Interaction | Rating | ... |&#10;| ---- | ... |&#10;| Sep 22, 2026 | ... |"
                className="min-h-14 flex-1 rounded-md border border-zinc-200 bg-white p-2 font-mono text-[11px] text-zinc-900 placeholder:font-sans placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={fillFromSheet}
                disabled={!sheetText.trim()}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white cursor-pointer"
              >
                Fill fields
              </button>
            </div>
            {sheetResult && (
              <div className="mt-2 space-y-1 text-[11px]">
                {sheetResult.filled > 0 && (
                  <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Filled {sheetResult.filled} field{sheetResult.filled === 1 ? '' : 's'}. Review them, then click Save.
                  </p>
                )}
                {sheetResult.warnings.map((w) => (
                  <p key={w} className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Form Fields: Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                max={todayLocal()}
                value={interactionDate}
                onChange={(e) => { setInteractionDate(e.target.value); if (e.target.value) setDateError(false); }}
                // Open the calendar from anywhere in the box, not only the small icon (where supported).
                onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* not supported */ } }}
                // color-scheme makes the browser draw a light calendar icon and popup in dark mode.
                className={`h-8 w-full cursor-pointer rounded-md border bg-white px-3 text-xs text-zinc-900 [color-scheme:light] focus:border-zinc-400 focus:outline-hidden dark:bg-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark] ${
                  dateError ? 'border-rose-500' : 'border-zinc-200 dark:border-zinc-800'
                }`}
              />
              {dateError
                ? <p className="mt-1 text-[11px] text-rose-500">Select the date the interaction took place.</p>
                : <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Select the day the interaction actually took place.</p>}
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
              <TopicMultiPicker
                options={topicOptions}
                value={topics}
                invalid={topicsError}
                onChange={(next) => { setTopics(next); if (next.length) setTopicsError(false); }}
              />
              {topicsError && <p className="mt-1 text-[11px] text-rose-500">Select at least one topic.</p>}
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
              {/* Multi-line so text pasted from the sheet keeps its line breaks. */}
              <textarea
                rows={2}
                value={tweakedQuestions}
                onChange={(e) => setTweakedQuestions(e.target.value)}
                placeholder="Any customized variant problems posed"
                className="w-full rounded-md border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Action Items
              </label>
              <textarea
                rows={2}
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="1) Practice implementation problems across all Level-0 topics"
                className="w-full rounded-md border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Interaction cell link (stored in the meetRecording / meet_recording field, which held meet links before) */}
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Interaction Cell Link from Sheet
            </label>
            <input
              type="url"
              value={meetRecording}
              onChange={(e) => setMeetRecording(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=...&range=..."
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
              <span>{editing ? 'Save Changes' : 'Save Interaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
