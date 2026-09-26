'use client';

import React, { useState, useMemo } from 'react';
import { Student } from '@/lib/types';
import { instructorNamesMatch } from '@/lib/storage';
import { 
  Search, 
  Play, 
  History, 
  ChevronLeft, 
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';

const LEVEL_STEP_MAP: Record<string, string[]> = {
  'Level 0': ['1.0 Introduction', '1.1 - Data Types', '1.2 If else', '1.3 Loops', '2. Traversal', '3. Time & Space Complexity analysis', '4. Pattern Questions'],
  'Level 1': ['0', '1.1', '1.2', '1.3', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
  'Level 2': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
  'Level 3': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
  'Level 4': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
  'Level 5': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
  'Level 6': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'],
  'Level 7': ['0', '1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2']
};

const LEVEL_TOPIC_MAP: Record<string, string[]> = {
  'Level 0': ['1.0 Introduction', '1.1 - Data Types', '1.2 If else', '1.3 Loops', '2. Traversal', '3. Time & Space Complexity analysis', '4. Pattern Questions'],
  'Level 1': ['Maths', 'STL - Introduction', 'STL - Standard Template Library', 'Array - Basics', 'Arrays', 'String'],
  'Level 2': ['Recursion', 'Sorting', 'Binary Search'],
  'Level 3': ['Two pointers / Sliding window', 'Greedy Algorithms'],
  'Level 4': ['Bit Manipulation', 'Stack & Queues', 'Stack - Monotonic Stack'],
  'Level 5': ['Hashing', 'Heap', 'Graphs', 'Dynamic programming'],
  'Level 6': ['Advanced trees', 'Backtracking', 'Trie', 'Segment tree'],
  'Level 7': ['Advanced DSA / Mock Interview Track']
};

interface StudentRosterTableProps {
  students: Student[];
  currentInstructor: string;
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
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (!isAllDirectory && currentInstructor !== 'Admin') {
        if (!instructorNamesMatch(s.instructor, currentInstructor)) return false;
      }

      if (search) {
        const q = search.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesId = s.id.toLowerCase().includes(q);
        const matchesInst = s.instructor.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesInst) return false;
      }

      if (levelFilter !== 'ALL' && s.level !== levelFilter) return false;
      if (degreeFilter !== 'ALL' && s.degree !== degreeFilter) return false;
      if (hallFilter !== 'ALL' && s.hall !== hallFilter) return false;

      if (statusFilter !== 'ALL') {
        if (statusFilter === 'CLEARED' && !s.status.includes('Cleared')) return false;
        if (statusFilter === 'REVISIT' && !s.status.includes('Revisit')) return false;
        if (statusFilter === 'NOT_STARTED' && (s.status.includes('Cleared') || s.status.includes('Revisit'))) return false;
      }

      return true;
    });
  }, [students, currentInstructor, isAllDirectory, search, levelFilter, degreeFilter, statusFilter, hallFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const stats = useMemo(() => {
    const list = isAllDirectory || currentInstructor === 'Admin'
      ? students
      : students.filter((s) => instructorNamesMatch(s.instructor, currentInstructor));

    const total = list.length;
    const level0Count = list.filter((s) => s.level === 'Level 0').length;
    const cleared = list.filter((s) => s.status.includes('Cleared')).length;
    const revisit = list.filter((s) => s.status.includes('Revisit')).length;
    const pending = total - (cleared + revisit);

    return { total, level0Count, cleared, revisit, pending };
  }, [students, currentInstructor, isAllDirectory]);

  return (
    <div className="space-y-4">
      {/* Metric summary strip - Linear/Stripe quiet design (unified neutral cards, semantic dots) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Assigned</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{stats.total}</span>
            <span className="text-[11px] text-zinc-400">candidates</span>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Level 0 Target</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{stats.level0Count}</span>
            <span className="text-[11px] text-zinc-400">baseline</span>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Pending Evaluation</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{stats.pending}</span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              awaiting
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Need to Revisit</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{stats.revisit}</span>
            <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              re-eval
            </span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cleared / Passed</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{stats.cleared}</span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              promoted
            </span>
          </div>
        </div>
      </div>

      {/* Filter and search toolbar - High utility, compact */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by student name, roll ID, or instructor..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-8 w-full rounded-md border border-zinc-200 bg-zinc-50/50 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
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
            <option value="Level 0">Level 0</option>
            <option value="Level 1">Level 1</option>
            <option value="Level 2">Level 2</option>
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
            <option value="NOT_STARTED">Pending Evaluation</option>
            <option value="REVISIT">Need to Revisit</option>
            <option value="CLEARED">Cleared</option>
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
        </div>
      </div>

      {/* Students Data Table - Linear high-density table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/60 font-medium text-zinc-500 dark:text-zinc-400">
                <th className="py-2.5 pl-4 pr-3">Student</th>
                <th className="py-2.5 px-3">Roll ID</th>
                <th className="py-2.5 px-3">Degree & Section</th>
                <th className="py-2.5 px-3">Exam Hall</th>
                <th className="py-2.5 px-3">Assigned Evaluator</th>
                <th className="py-2.5 px-3">Level</th>
                <th className="py-2.5 px-3">Current Step</th>
                <th className="py-2.5 px-3">Current Topic</th>
                <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
              {paginated.map((student) => {
                const isCleared = student.status.includes('Cleared');
                const isRevisit = student.status.includes('Revisit');

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

                    {/* Student ID */}
                    <td className="py-2.5 px-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {student.id}
                    </td>

                    {/* Degree & Section */}
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                      {student.degree} • {student.section}
                    </td>

                    {/* Exam Hall */}
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400 font-mono">
                      {student.hall}
                    </td>

                    {/* Instructor */}
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {student.instructor}
                      </span>
                    </td>

                    {/* Level */}
                    <td className="py-2.5 px-3">
                      {!isAllDirectory ? (
                        <select
                          value={student.level}
                          onChange={(e) => onUpdateStudentLevel?.(student.id, e.target.value)}
                          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-mono text-zinc-700 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {Array.from({ length: 8 }, (_, index) => `Level ${index}`).map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                          {student.level}
                        </span>
                      )}
                    </td>

                    {/* Current Step */}
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                      {!isAllDirectory ? (
                        <select
                          value={student.currentStep || (LEVEL_STEP_MAP[student.level] || ['NOT APPLICABLE'])[0]}
                          onChange={(e) => onUpdateStudentStep?.(student.id, e.target.value)}
                          className="h-8 min-w-[150px] rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-700 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {(LEVEL_STEP_MAP[student.level] || ['NOT APPLICABLE']).map((step) => (
                            <option key={step} value={step}>{step}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] leading-relaxed">
                          {student.currentStep || (LEVEL_STEP_MAP[student.level] || ['NOT APPLICABLE'])[0]}
                        </span>
                      )}
                    </td>

                    {/* Current Topic */}
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                      {!isAllDirectory ? (
                        <select
                          value={student.currentTopic || (LEVEL_TOPIC_MAP[student.level] || ['NOT APPLICABLE'])[0]}
                          onChange={(e) => onUpdateStudentTopic?.(student.id, e.target.value)}
                          className="h-8 min-w-[180px] rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-700 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {(LEVEL_TOPIC_MAP[student.level] || ['NOT APPLICABLE']).map((topic) => (
                            <option key={topic} value={topic}>{topic}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] leading-relaxed">
                          {student.currentTopic || (LEVEL_TOPIC_MAP[student.level] || ['NOT APPLICABLE'])[0]}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isAllDirectory && (
                          <button
                            onClick={() => onStartInteraction(student)}
                            title="Log a new interaction"
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer"
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
                  <td colSpan={9} className="py-12 text-center text-xs text-zinc-500">
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
