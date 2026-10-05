'use client';
 
import React, { useState, useMemo, useEffect } from 'react';
import { Student } from '@/lib/types';
import { isStudentAssignedTo, normalizeTopicValue } from '@/lib/storage';
import { ALL_TOPICS, LEVELS, getStepOptionsForTopic, getTopicOptions } from '@/lib/multiLevelCurriculum';
import { LevelOverview, STATUS_KEYS, STATUS_META, statusKeyOf } from '@/components/LevelOverview';
import { 
  Search, 
  Play, 
  History, 
  ChevronLeft, 
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';

interface StudentRosterTableProps {
  students: Student[];
  currentInstructor: string;
  currentInstructorEmail?: string;
  onStartInteraction: (student: Student) => void;
  onViewHistory: (student: Student) => void;
  onUpdateStudentLevel?: (studentId: string, nextLevel: string) => void;
  onUpdateStudentStep?: (studentId: string, nextStep: string) => void;
  onUpdateStudentTopic?: (studentId: string, nextTopic: string) => void;
  isAllDirectory?: boolean;
}

export function StudentRosterTable({
  students,
  currentInstructor,
  currentInstructorEmail,
  onStartInteraction,
  onViewHistory,
  onUpdateStudentLevel,
  onUpdateStudentStep,
  onUpdateStudentTopic,
  isAllDirectory = false
}: StudentRosterTableProps) {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [degreeFilter, setDegreeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [hallFilter, setHallFilter] = useState('ALL');
  const [topicFilter, setTopicFilter] = useState('ALL');
  const [sortMode, setSortMode] = useState<'natural' | 'top-performing'>(isAllDirectory ? 'top-performing' : 'natural');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    if (isAllDirectory) {
      setSortMode('top-performing');
    } else {
      setSortMode('natural');
    }
  }, [isAllDirectory]);

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

  const compareStudentProgress = (a: Student, b: Student) => {
    const levelDiff = getLevelNumber(b.level) - getLevelNumber(a.level);
    if (levelDiff !== 0) return levelDiff;

    const topicDiff = getTopicProgressionIndex(b.level, b.currentTopic) - getTopicProgressionIndex(a.level, a.currentTopic);
    if (topicDiff !== 0) return topicDiff;

    return getStepProgressionIndex(b.level, b.currentTopic, b.currentStep) - getStepProgressionIndex(a.level, a.currentTopic, a.currentStep);
  };

  const filtered = useMemo(() => {
    const matches = students.filter((s) => {
      if (!isAllDirectory && currentInstructor !== 'Admin') {
        if (!isStudentAssignedTo(s, { name: currentInstructor, email: currentInstructorEmail })) return false;
      }

      if (search) {
        const q = search.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesId = s.id.toLowerCase().includes(q);
        const matchesInst = [s.instructor, s.instructorFullName, s.instructorEmail].some((value) => (value || '').toLowerCase().includes(q));
        if (!matchesName && !matchesId && !matchesInst) return false;
      }

      if (levelFilter !== 'ALL' && s.level !== levelFilter) return false;
      if (degreeFilter !== 'ALL' && s.degree !== degreeFilter) return false;
      if (hallFilter !== 'ALL' && s.hall !== hallFilter) return false;
      if (topicFilter !== 'ALL' && normalizeTopicValue(s.currentTopic) !== normalizeTopicValue(topicFilter)) return false;

      if (statusFilter !== 'ALL' && statusKeyOf(s) !== statusFilter) return false;

      return true;
    });

    if (sortMode === 'top-performing') {
      return [...matches].sort(compareStudentProgress);
    }
    return matches;
  }, [students, currentInstructor, currentInstructorEmail, isAllDirectory, search, levelFilter, degreeFilter, statusFilter, hallFilter, topicFilter, sortMode]);

  const scoped = useMemo(() => {
    const base = isAllDirectory || currentInstructor === 'Admin'
      ? students
      : students.filter((s) => isStudentAssignedTo(s, { name: currentInstructor, email: currentInstructorEmail }));

    if (sortMode === 'top-performing') {
      return [...base].sort(compareStudentProgress);
    }
    return base;
  }, [students, currentInstructor, currentInstructorEmail, isAllDirectory, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusCounts = useMemo(() => {
    const counts = { PENDING: 0, IN_PROGRESS: 0, REVISIT: 0, CLEARED: 0 };
    for (const s of scoped) counts[statusKeyOf(s)]++;
    return counts;
  }, [scoped]);

  const applyOverviewFilter = (level: string, status: string) => {
    setLevelFilter(level);
    setStatusFilter(status);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Summary: overall standing at each student's current level. Cards filter the table (all levels). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <button
          type="button"
          onClick={() => applyOverviewFilter('ALL', 'ALL')}
          className={`rounded-lg border p-3.5 text-left transition-colors cursor-pointer ${levelFilter === 'ALL' && statusFilter === 'ALL' ? 'border-zinc-400 dark:border-zinc-600' : 'border-zinc-200 dark:border-zinc-800'} bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60`}
        >
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{isAllDirectory ? 'Total Students' : 'Total Assigned'}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{scoped.length}</span>
            <span className="text-[11px] text-zinc-400">across all levels</span>
          </div>
        </button>
        {STATUS_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => applyOverviewFilter('ALL', key)}
            className={`rounded-lg border p-3.5 text-left transition-colors cursor-pointer ${levelFilter === 'ALL' && statusFilter === key ? 'border-zinc-400 dark:border-zinc-600' : 'border-zinc-200 dark:border-zinc-800'} bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60`}
          >
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{STATUS_META[key].label}</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{statusCounts[key]}</span>
              <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[key].dot}`} />
                {STATUS_META[key].hint}
              </span>
            </div>
          </button>
        ))}
      </div>

      <LevelOverview students={scoped} activeLevel={levelFilter} activeStatus={statusFilter} onSelect={applyOverviewFilter} />

      {/* Filter and search toolbar - High utility, compact */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by student name, instructor, or ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="mr-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <span className="text-zinc-500 dark:text-zinc-400">Showing </span>
            <span className="font-mono text-zinc-900 dark:text-zinc-100">{filtered.length}</span>
            <span className="text-zinc-500 dark:text-zinc-400"> students</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-400 pl-1 mr-1 hidden lg:flex">
            <SlidersHorizontal className="h-3 w-3" />
            <span className="text-[11px]">Filters:</span>
          </div>

          <select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 hover:bg-zinc-50 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
          >
            <option value="ALL">All Levels</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>

          <select
            value={degreeFilter}
            onChange={(e) => {
              setDegreeFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 hover:bg-zinc-50 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
          >
            <option value="ALL">All Colleges</option>
            <option value="CDU">CDU</option>
            <option value="BITS">BITS</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 hover:bg-zinc-50 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
          >
            <option value="ALL">All Statuses</option>
            {STATUS_KEYS.map((key) => (
              <option key={key} value={key}>{STATUS_META[key].label}</option>
            ))}
          </select>

          <select
            value={topicFilter}
            onChange={(e) => {
              setTopicFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 hover:bg-zinc-50 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
          >
            <option value="ALL">All Topics</option>
            {ALL_TOPICS.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>

          <select
            value={hallFilter}
            onChange={(e) => {
              setHallFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 hover:bg-zinc-50 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors hidden md:block"
          >
            <option value="ALL">All Halls</option>
            {Array.from({ length: 14 }).map((_, i) => (
              <option key={i} value={`Hall ${i + 1}`}>
                Hall {i + 1}
              </option>
            ))}
          </select>

          {!isAllDirectory && (
            <select
              value={sortMode}
              onChange={(e) => {
                setSortMode(e.target.value as 'natural' | 'top-performing');
                setPage(1);
              }}
              className="h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 hover:bg-zinc-50 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
            >
              <option value="natural">Default order</option>
              <option value="top-performing">Top performing</option>
            </select>
          )}
        </div>
      </div>

      {/* Students Data Table - Linear high-density table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/60 font-medium text-zinc-500 dark:text-zinc-400">
                <th className="py-2.5 pl-4 pr-3">Student</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Degree & Section</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Exam Hall</th>
                {/* Assigned page lists only the signed-in instructor's students, so the column is Directory-only. */}
                {isAllDirectory && <th className="py-2.5 px-3">Assigned Evaluator</th>}
                <th className="py-2.5 px-3">Level</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Current Topic</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Current Step</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 pl-3 pr-4 text-right">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
              {paginated.map((student) => {
                const statusMeta = STATUS_META[statusKeyOf(student)];
                const topicOptions = getTopicOptions(student.level);
                const stepOptions = getStepOptionsForTopic(student.level, student.currentTopic);
                const safeStepValue = stepOptions.includes(student.currentStep || '') ? student.currentStep : stepOptions[0];
                const safeTopicValue = topicOptions.includes(student.currentTopic || '') ? student.currentTopic : topicOptions[0];

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    {/* Student Name */}
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {student.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 sm:hidden font-mono mt-0.5">
                        {student.id}
                      </div>
                    </td>

                    {/* Degree & Section */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {student.degree} • {student.section}
                    </td>

                    {/* Exam Hall */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-zinc-600 dark:text-zinc-400 font-mono">
                      {student.hall}
                    </td>

                    {/* Instructor */}
                    {isAllDirectory && (
                      <td className="py-2.5 px-3">
                        <span
                          className="font-medium text-zinc-800 dark:text-zinc-200"
                          title={student.instructorFullName ? `${student.instructorFullName} • ${student.instructorEmail}` : undefined}
                        >
                          {student.instructor}
                        </span>
                        {student.instructorMatch && student.instructorMatch !== 'matched' && (
                          <span
                            className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            title={student.instructorMatch === 'ambiguous' ? 'Several instructors share this first name; add an alias or email to identify the right one' : 'No instructor in the directory matches this name'}
                          >
                            {student.instructorMatch === 'ambiguous' ? 'ambiguous' : 'unmatched'}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Level */}
                    <td className="py-2.5 px-3">
                      {!isAllDirectory ? (
                        <select
                          value={student.level}
                          onChange={(e) => onUpdateStudentLevel?.(student.id, e.target.value)}
                          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-mono text-zinc-700 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {LEVELS.map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                          {student.level}
                        </span>
                      )}
                    </td>

                    {/* Current Topic */}
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                      {!isAllDirectory ? (
                        <select
                          value={safeTopicValue}
                          onChange={(e) => onUpdateStudentTopic?.(student.id, e.target.value)}
                          className="h-8 w-36 max-w-36 truncate rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-700 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {topicOptions.map((topic) => (
                            <option key={topic} value={topic}>{topic}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] leading-relaxed">
                          {safeTopicValue}
                        </span>
                      )}
                    </td>

                    {/* Current Step */}
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                      {!isAllDirectory ? (
                        <select
                          value={safeStepValue}
                          onChange={(e) => onUpdateStudentStep?.(student.id, e.target.value)}
                          className="h-8 w-40 max-w-40 truncate rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-700 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {stepOptions.map((step) => (
                            <option key={step} value={step}>{step}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] leading-relaxed">
                          {safeStepValue}
                        </span>
                      )}
                    </td>

                    {/* Status at current level */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isAllDirectory && (
                          <button
                            onClick={() => onStartInteraction(student)}
                            title="Log a new interaction"
                            className="inline-flex items-center gap-1 h-7 px-2.5 whitespace-nowrap rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>Log Interaction</span>
                          </button>
                        )}

                        <button
                          onClick={() => onViewHistory(student)}
                          title="View evaluation timeline & past sessions"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginated.length === 0 && (
                <tr>
                  <td colSpan={isAllDirectory ? 9 : 8} className="py-12 text-center text-xs text-zinc-500">
                    No candidates match the active filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Minimal pagination bar */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40 text-xs">
          <div className="text-zinc-500 dark:text-zinc-400 font-mono">
            Showing <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{(currentPage - 1) * pageSize + 1}</strong> -{' '}
            <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{Math.min(currentPage * pageSize, filtered.length)}</strong> of{' '}
            <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{filtered.length}</strong> candidates
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-2 text-zinc-500 font-mono text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
