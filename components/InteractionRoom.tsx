'use client';

import React, { useState, useEffect } from 'react';
import { Student, CurriculumStep, QuestionItem } from '@/lib/types';
import rawCurriculum from '@/lib/data/curriculum.json';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckSquare, 
  Square, 
  Clock, 
  ArrowRight, 
  FileText, 
  Copy, 
  Check, 
  X 
} from 'lucide-react';

interface InteractionRoomProps {
  student: Student;
  currentInstructor: string;
  onClose: () => void;
  onProceedToForm: (draft: {
    student: Student;
    round: number;
    selectedTopics: string;
    questionsAskedList: string[];
    notes: string;
    stepRatings?: Record<string, number>;
  }) => void;
}

export function InteractionRoom({
  student,
  currentInstructor,
  onClose,
  onProceedToForm
}: InteractionRoomProps) {
  const curriculum: CurriculumStep[] = rawCurriculum as CurriculumStep[];
  const getCurriculumForRound = (selectedRound: number) =>
    curriculum.filter((step) => {
      const group = Number.parseInt(step.step.split('.')[0], 10);
      if (Number.isNaN(group)) return false;
      if (selectedRound === 1) return group >= 1 && group <= 2;
      if (selectedRound === 2) return group >= 3 && group <= 4;
      return false;
    });

  const [round, setRound] = useState(student.interactionCount === 0 ? 1 : 2);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, string[]>>({});
  const [hintsGiven, setHintsGiven] = useState<Record<string, number>>({});
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({});
  const [copiedQuestion, setCopiedQuestion] = useState<string | null>(null);

  const visibleCurriculum = getCurriculumForRound(round);
  const activeStep = visibleCurriculum[activeStepIndex] || visibleCurriculum[0] || curriculum[1];

  const [timerSeconds, setTimerSeconds] = useState((activeStep.suggestedTimeMins || 15) * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const handleSelectRound = (nextRound: number) => {
    setRound(nextRound);
    const nextVisible = getCurriculumForRound(nextRound);
    const nextStep = nextVisible[0] || curriculum[1];
    setActiveStepIndex(0);
    setTimerSeconds((nextStep.suggestedTimeMins || 15) * 60);
    setIsTimerRunning(false);
  };

  const handleSelectStep = (idx: number) => {
    setActiveStepIndex(idx);
    const step = visibleCurriculum[idx] || visibleCurriculum[0] || curriculum[1];
    setTimerSeconds((step.suggestedTimeMins || 15) * 60);
    setIsTimerRunning(false);
  };

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleQuestion = (stepId: string, qTitle: string) => {
    setSelectedQuestions((prev) => {
      const currentList = prev[stepId] || [];
      if (currentList.includes(qTitle)) {
        return { ...prev, [stepId]: currentList.filter((q) => q !== qTitle) };
      } else {
        return { ...prev, [stepId]: [...currentList, qTitle] };
      }
    });
  };

  const adjustHint = (stepId: string, delta: number) => {
    setHintsGiven((prev) => ({
      ...prev,
      [stepId]: Math.max(0, (prev[stepId] || 0) + delta)
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestion(text);
    setTimeout(() => setCopiedQuestion(null), 1500);
  };

  const allAskedQuestions = [...new Set(
    visibleCurriculum.flatMap((step) => selectedQuestions[step.id] || [])
  )];

  const combinedNotes = Object.entries(stepNotes)
    .filter(([, note]) => note.trim().length > 0)
    .map(([sId, note]) => {
      const step = curriculum.find((c) => c.id === sId);
      return `[Step ${step?.step || sId} - ${step?.title || ''}]\n${note.trim()}`;
    })
    .join('\n\n');

  const handleFinishAndFillForm = () => {
    const selectedRoundTopics = visibleCurriculum
      .map((step) => `${step.step} ${step.title}`)
      .join(', ');

    const roundLabel = `Round ${round} (${visibleCurriculum[0]?.step || '1.0'} to ${visibleCurriculum[visibleCurriculum.length - 1]?.step || '4.0'})`;

    onProceedToForm({
      student,
      round,
      selectedTopics: `${roundLabel}: ${selectedRoundTopics || `${activeStep.step} ${activeStep.title}`}`,
      questionsAskedList: allAskedQuestions,
      notes: combinedNotes
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-50 text-zinc-900 overflow-hidden dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      {/* Top telemetry control bar - Linear quiet cockpit style */}
      <div className="flex h-13 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {student.name}
            </span>
            <span className="font-mono text-xs text-zinc-500">
              {student.id}
            </span>
          </div>

          <span className="text-xs text-zinc-400">•</span>

          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {student.degree} • {student.section} ({student.hall})
          </span>

          <span className="text-xs text-zinc-400">•</span>

          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Evaluator: <strong className="font-medium text-zinc-800 dark:text-zinc-200">{currentInstructor}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Round selector */}
          <div className="flex items-center rounded-md border border-zinc-200 bg-zinc-100/70 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => handleSelectRound(1)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                round === 1
                  ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              Round 1
            </button>
            <button
              onClick={() => handleSelectRound(2)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                round === 2
                  ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              Round 2
            </button>
          </div>

          {/* Stopwatch timer */}
          <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 h-8 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-semibold">{formatTimer(timerSeconds)}</span>
            <div className="flex items-center gap-0.5 border-l border-zinc-200 dark:border-zinc-800 pl-1.5 ml-1">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="p-1 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer text-zinc-500"
                title={isTimerRunning ? 'Pause' : 'Start'}
              >
                {isTimerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </button>
              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds((activeStep.suggestedTimeMins || 15) * 60);
                }}
                className="p-1 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer text-zinc-500"
                title="Reset"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main dual-pane cockpit */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Curriculum Steps & Question Checklist */}
        <div className="flex w-full md:w-3/5 flex-col border-r border-zinc-200 bg-white overflow-y-auto dark:border-zinc-800 dark:bg-zinc-950">
          {/* Step navigator tab bar */}
          <div className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/90 p-2.5 backdrop-blur-xs dark:border-zinc-800 dark:bg-zinc-900/90">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {visibleCurriculum.map((step, idx) => {
                const isActive = idx === activeStepIndex;
                const askedInThisStep = (selectedQuestions[step.id] || []).length;

                return (
                  <button
                    key={step.id}
                    onClick={() => handleSelectStep(idx)}
                    className={`flex items-center gap-1.5 shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span className="font-mono text-[11px] opacity-70">{step.step}</span>
                    <span>{step.title.split(' ')[0]}</span>
                    {askedInThisStep > 0 && (
                      <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        isActive ? 'bg-zinc-700 text-zinc-100 dark:bg-zinc-300 dark:text-zinc-900' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {askedInThisStep}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Step Details */}
          <div className="p-5 space-y-5">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      STEP {activeStep.step}
                    </span>
                    <span className="text-zinc-400">•</span>
                    <span className="text-xs text-zinc-500">
                      Allocated: ~{activeStep.suggestedTimeMins} mins
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {activeStep.title}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                    {activeStep.expectation}
                  </p>
                </div>

                {/* Hints counter */}
                <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  <span>Hints: <strong className="font-mono">{hintsGiven[activeStep.id] || 0}</strong></span>
                  <button
                    onClick={() => adjustHint(activeStep.id, 1)}
                    className="ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 cursor-pointer"
                  >
                    +1
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 pt-2.5 border-t border-zinc-200/80 dark:border-zinc-800/80 text-[11px] text-zinc-500">
                <div>
                  <strong className="text-zinc-800 dark:text-zinc-200 font-medium">Question Rule:</strong> {activeStep.questionRule}
                </div>
                {activeStep.hintRule && (
                  <div>
                    • <strong className="text-zinc-800 dark:text-zinc-200 font-medium">Hint Rule:</strong> {activeStep.hintRule}
                  </div>
                )}
              </div>
            </div>

            {/* Questions to ask */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Curriculum Questions ({activeStep.questions?.length || 0})
                </span>
                <span className="text-[11px] text-zinc-400">
                  Check posed questions to auto-populate the sheet
                </span>
              </div>

              <div className="space-y-2">
                {activeStep.questions?.map((q: QuestionItem, idx: number) => {
                  const isChecked = (selectedQuestions[activeStep.id] || []).includes(q.title);

                  return (
                    <div
                      key={q.id || idx}
                      className={`group rounded-lg border p-3 transition-colors ${
                        isChecked
                          ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-300 dark:bg-zinc-900'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => toggleQuestion(activeStep.id, q.title)}
                          className="mt-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
                          ) : (
                            <Square className="h-4 w-4 text-zinc-400" />
                          )}
                        </button>

                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                              {q.title}
                            </p>
                            <button
                              onClick={() => copyToClipboard(q.title)}
                              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-0.5 cursor-pointer"
                              title="Copy question text"
                            >
                              {copiedQuestion === q.title ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>

                          {q.description && (
                            <div className="rounded border border-zinc-200 bg-zinc-50 p-2 font-mono text-[11px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                              {q.description}
                            </div>
                          )}

                          {q.answer && (
                            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">Expected:</span>
                              <span>{q.answer}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Scratchpad & Evaluation Summary */}
        <div className="hidden md:flex w-2/5 flex-col bg-zinc-50/70 dark:bg-zinc-900/40 overflow-y-auto">
          <div className="p-5 space-y-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Evaluation Scratchpad
                </h3>
              </div>
              <span className="font-mono text-[11px] text-zinc-400">
                Auto-saves locally
              </span>
            </div>

            {/* Questions logged list */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Questions Logged:</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{allAskedQuestions.length}</span>
              </div>
              {allAskedQuestions.length === 0 ? (
                <p className="text-[11px] text-zinc-400 italic">
                  Select questions from the left panel as you ask them.
                </p>
              ) : (
                <ul className="space-y-1 max-h-36 overflow-y-auto text-xs text-zinc-700 dark:text-zinc-300 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {allAskedQuestions.map((q, i) => (
                    <li key={i} className="pt-1 flex items-start gap-1.5">
                      <span className="font-mono text-[10px] text-zinc-400">{i + 1}.</span>
                      <span className="truncate">{q}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Step remarks textarea */}
            <div className="flex-1 flex flex-col space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Notes for Step {activeStep.step}:</span>
                <span className="text-[11px] text-zinc-400 font-normal">Candidate syntax, misconceptions</span>
              </label>
              <textarea
                value={stepNotes[activeStep.id] || ''}
                onChange={(e) => setStepNotes({ ...stepNotes, [activeStep.id]: e.target.value })}
                placeholder={`Example: Candidate understood ${activeStep.title} logic, but struggled with 10^6 integer constraints and long long usage.`}
                className="w-full flex-1 min-h-[140px] rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 transition-colors"
              />
            </div>

            {/* Quick remark chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Common Tags:
              </span>
              <div className="flex flex-wrap gap-1">
                {[
                  'Stuck on 10^6 constraints',
                  'Weak on char/ASCII indexing',
                  'Understood float vs double',
                  'Correct cin/cout syntax',
                  'Needs more pen-paper practice',
                  'Confused 0-indexed vs 1-indexed'
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const cur = stepNotes[activeStep.id] || '';
                      setStepNotes({
                        ...stepNotes,
                        [activeStep.id]: cur ? `${cur}\n• ${tag}` : `• ${tag}`
                      });
                    }}
                    className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
            <button
              onClick={handleFinishAndFillForm}
              className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium transition-colors cursor-pointer shadow-xs"
            >
              <span>Complete Interaction & Fill Sheet 2 Form</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <p className="text-center text-[11px] text-zinc-400 mt-1.5">
              Opens the 12-column logging form with Granola transcript parser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
