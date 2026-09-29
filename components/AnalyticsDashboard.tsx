'use client';

import React, { useMemo, useState } from 'react';
import { Student, InteractionLog, InstructorSummary } from '@/lib/types';
import { instructorNamesMatch } from '@/lib/storage';
import { ALL_TOPICS, LEVELS } from '@/lib/multiLevelCurriculum';
import { todayLocal } from '@/lib/dates';
import { DailyCollegeOverview } from '@/components/DailyCollegeOverview';
import { StudentHistoryModal } from '@/components/StudentHistoryModal';
import { 
  Download, 
  BarChart2, 
  Users,
  CalendarRange,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface AnalyticsDashboardProps {
  students: Student[];
  interactions: InteractionLog[];
  instructorSummaries: InstructorSummary[];
  onExportCSV: () => void;
  onSelectInstructor: (name: string) => void;
  currentInstructorId?: string | null;
}

function withinLastDays(logDate: string, days: number): boolean {
  const date = new Date(logDate);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return date >= cutoff;
}

export function AnalyticsDashboard({
  students,
  interactions,
  instructorSummaries,
  onExportCSV,
  onSelectInstructor,
  currentInstructorId
}: AnalyticsDashboardProps) {
  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [instructorSearch, setInstructorSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [topicSearch, setTopicSearch] = useState('');

  const totalStudents = students.length;

  const levelDistribution = LEVELS.map((lvl) => ({
    level: lvl,
    count: students.filter((s) => s.level === lvl).length
  }));

  const todayIso = todayLocal();
  const interactionsToday = interactions.filter((log) => log.date === todayIso).length;
  const clearedTodayStudents = new Set(
    interactions
      .filter((log) => log.date === todayIso && log.statusPostInteraction === 'Cleared')
      .map((log) => log.studentId)
  ).size;
  const revisitTodayStudents = new Set(
    interactions
      .filter((log) => log.date === todayIso && log.statusPostInteraction === 'Need to Revisit')
      .map((log) => log.studentId)
  ).size;
  const crossedProgressionStudents = new Set(
    students
      .filter((student) => {
        // Progressed = beyond Level 0, or past Introduction (topic or step) within Level 0.
        return student.level !== 'Level 0' || student.currentTopic !== 'Introduction' || student.currentStep !== 'Introduction';
      })
      .map((student) => student.id)
  ).size;

  // Topics come from the DB and are validated against the curriculum on save, so exact matching is enough.
  const topicProgressionCounts = ALL_TOPICS.map((topic) => ({
    topic,
    count: students.filter((student) => student.currentTopic === topic).length,
  })).filter((entry) => {
    const query = topicSearch.trim().toLowerCase();
    if (!query) return true;
    return entry.topic.toLowerCase().includes(query);
  });

  const collegeAnalytics = useMemo(() => {
    return ['CDU', 'BITS'].map((college) => {
      const collegeStudents = students.filter((student) => student.degree === college);
      const collegeStudentIds = new Set(collegeStudents.map((student) => student.id));
      const collegeInteractions = interactions.filter((log) => collegeStudentIds.has(log.studentId));

      return {
        college,
        studentCount: collegeStudents.length,
        totalInteractions: collegeInteractions.length,
        todayInteractions: collegeInteractions.filter((log) => log.date === todayIso).length,
        clearedStudents: new Set(
          collegeInteractions.filter((log) => log.statusPostInteraction === 'Cleared').map((log) => log.studentId)
        ).size,
        revisitStudents: new Set(
          collegeInteractions.filter((log) => log.statusPostInteraction === 'Need to Revisit').map((log) => log.studentId)
        ).size,
      };
    });
  }, [students, interactions, todayIso]);

  const instructorAnalytics = useMemo(() => {
    return instructorSummaries.map((inst) => {
      const instLogs = interactions.filter((log) => {
        // "Taken by" is resolved to an instructor id on the server when the log is saved.
        if (log.takenByInstructorId && inst.id) return log.takenByInstructorId === inst.id;
        return instructorNamesMatch(log.instructorName || '', inst.name || '');
      });
      const today = instLogs.filter((log) => log.date === todayIso).length;
      const last3 = instLogs.filter((log) => withinLastDays(log.date, 3)).length;
      const last7 = instLogs.filter((log) => withinLastDays(log.date, 7)).length;
      const cleared = instLogs.filter((log) => log.statusPostInteraction === 'Cleared').length;
      const revisits = instLogs.filter((log) => log.statusPostInteraction === 'Need to Revisit').length;
      return { ...inst, today, last3, last7, cleared, revisits };
    });
  }, [instructorSummaries, interactions, todayIso]);

  const filteredInstructorAnalytics = useMemo(() => {
    const query = instructorSearch.trim().toLowerCase();
    if (!query) return instructorAnalytics;
    return instructorAnalytics.filter((inst) =>
      inst.name.toLowerCase().includes(query)
    );
  }, [instructorAnalytics, instructorSearch]);

  const selectedInstructorDetail = selectedInstructor
    ? instructorAnalytics.find((inst) => inst.name === selectedInstructor) || null
    : null;

  const studentAnalytics = useMemo(() => {
    return students.map((student) => {
      const studentLogs = interactions.filter((log) => log.studentId === student.id);
      const cleared = studentLogs.filter((log) => log.statusPostInteraction === 'Cleared').length;
      const revisits = studentLogs.filter((log) => log.statusPostInteraction === 'Need to Revisit').length;
      const latest = studentLogs[0];
      return {
        ...student,
        interactionCount: studentLogs.length,
        cleared,
        revisits,
        lastInteractionDate: latest?.date || student.lastInteractionDate || 'N/A',
        lastStatus: latest?.statusPostInteraction || student.status,
      };
    });
  }, [students, interactions]);

  const filteredStudentAnalytics = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return studentAnalytics;
    return studentAnalytics.filter((student) =>
      student.name.toLowerCase().includes(query)
    );
  }, [studentAnalytics, studentSearch]);

  const selectedStudentDetail = selectedStudentId
    ? studentAnalytics.find((student) => student.id === selectedStudentId) || null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Cohort Telemetry & Performance
            </h2>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Daily interaction metrics, revisit counts, and instructor/student analytics across the cohort.
          </p>
        </div>

        <button
          onClick={onExportCSV}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Export Summary (CSV)</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400"><CalendarRange className="h-3.5 w-3.5" />Interactions Taken</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{interactionsToday}</div>
          <div className="mt-2 text-[11px] text-zinc-500">Total interactions taken today</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400"><CheckCircle2 className="h-3.5 w-3.5" />Successful Completion</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{clearedTodayStudents}</div>
          <div className="mt-2 text-[11px] text-zinc-500">Students cleared today</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400"><AlertTriangle className="h-3.5 w-3.5" />Revisit Count</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{revisitTodayStudents}</div>
          <div className="mt-2 text-[11px] text-zinc-500">Students needing rework today</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400"><Users className="h-3.5 w-3.5" />Level/Topic Crossed</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">{crossedProgressionStudents}</div>
          <div className="mt-2 text-[11px] text-zinc-500">Students advanced beyond Level 0 or an intro topic</div>
        </div>
      </div>

      <DailyCollegeOverview students={students} interactions={interactions} currentInstructorId={currentInstructorId} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs lg:col-span-2">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-3">College-wise Analytics</div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {collegeAnalytics.map(({ college, studentCount, totalInteractions, todayInteractions, clearedStudents, revisitStudents }) => (
              <div key={college} className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{college}</span>
                  <span className="text-[11px] text-zinc-500">{studentCount} students</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <div className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500">Total Interactions</div>
                    <div className="mt-1 font-mono text-lg text-zinc-900 dark:text-zinc-100">{totalInteractions}</div>
                  </div>
                  <div className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500">Today</div>
                    <div className="mt-1 font-mono text-lg text-zinc-900 dark:text-zinc-100">{todayInteractions}</div>
                  </div>
                  <div className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500">Cleared</div>
                    <div className="mt-1 font-mono text-lg text-emerald-600 dark:text-emerald-400">{clearedStudents}</div>
                  </div>
                  <div className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500">Revisit</div>
                    <div className="mt-1 font-mono text-lg text-amber-600 dark:text-amber-400">{revisitStudents}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Instructor Metrics</div>
            <input
              type="text"
              value={instructorSearch}
              onChange={(e) => setInstructorSearch(e.target.value)}
              placeholder="Search instructor"
              className="w-52 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:placeholder:text-zinc-500"
            />
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
                <tr>
                  <th className="py-2 pl-4 pr-2">Instructor</th>
                  <th className="py-2 px-3 text-right">Today</th>
                  <th className="py-2 px-3 text-right">Last 3 Days</th>
                  <th className="py-2 px-3 text-right">Last 7 Days</th>
                  <th className="py-2 px-3 text-right">Cleared</th>
                  <th className="py-2 px-3 text-right">Revisits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                {filteredInstructorAnalytics.length > 0 ? filteredInstructorAnalytics.map((inst) => (
                  <tr
                    key={inst.name}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedInstructor(inst.name);
                      onSelectInstructor(inst.name);
                    }}
                  >
                    <td className="py-2 pl-4 pr-2 font-medium text-zinc-900 dark:text-zinc-100">{inst.name}</td>
                    <td className="py-2 px-3 text-right font-mono">{inst.today}</td>
                    <td className="py-2 px-3 text-right font-mono">{inst.last3}</td>
                    <td className="py-2 px-3 text-right font-mono">{inst.last7}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{inst.cleared}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-600 dark:text-amber-400">{inst.revisits}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-xs text-zinc-500">No instructor matches your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Selected Instructor Detail</div>
          {selectedInstructorDetail ? (
            <div className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
              <div><span className="text-zinc-500">Name:</span> <strong className="text-zinc-900 dark:text-zinc-100">{selectedInstructorDetail.name}</strong></div>
              <div><span className="text-zinc-500">Interactions today:</span> <span className="font-mono text-zinc-900 dark:text-zinc-100">{selectedInstructorDetail.today}</span></div>
              <div><span className="text-zinc-500">Interactions last 3 days:</span> <span className="font-mono text-zinc-900 dark:text-zinc-100">{selectedInstructorDetail.last3}</span></div>
              <div><span className="text-zinc-500">Interactions last 7 days:</span> <span className="font-mono text-zinc-900 dark:text-zinc-100">{selectedInstructorDetail.last7}</span></div>
              <div><span className="text-zinc-500">Cleared sessions:</span> <span className="font-mono text-emerald-600 dark:text-emerald-400">{selectedInstructorDetail.cleared}</span></div>
              <div><span className="text-zinc-500">Revisit sessions:</span> <span className="font-mono text-amber-600 dark:text-amber-400">{selectedInstructorDetail.revisits}</span></div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Click an instructor row to view daily, 3-day, and 7-day metrics.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Level Distribution</div>
          <div className="space-y-3">
            {levelDistribution.map(({ level, count }) => {
              const pct = totalStudents ? ((count / totalStudents) * 100).toFixed(1) : '0.0';
              return (
                <div key={level} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{level}</span>
                    <span className="font-mono text-zinc-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Current Topic Progression</div>
            <input
              type="text"
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              placeholder="Search topic"
              className="w-40 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:placeholder:text-zinc-500"
            />
          </div>
          <div className="space-y-2 max-h-[330px] overflow-y-auto pr-1">
            {topicProgressionCounts.length > 0 ? topicProgressionCounts.map(({ topic, count }) => (
              <div key={topic} className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 gap-3">
                <span className="truncate pr-2">{topic}</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-100">{count}</span>
              </div>
            )) : (
              <p className="text-xs text-zinc-500">No matching topic found.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Student Interaction Analytics</div>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search student"
              className="w-52 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:placeholder:text-zinc-500"
            />
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
                <tr>
                  <th className="py-2 pl-4 pr-2">Student</th>
                  <th className="py-2 px-3 text-right">Interactions</th>
                  <th className="py-2 px-3 text-right">Cleared</th>
                  <th className="py-2 px-3 text-right">Revisits</th>
                  <th className="py-2 px-3 text-right">Last</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                {filteredStudentAnalytics.length > 0 ? filteredStudentAnalytics.slice().sort((a, b) => b.interactionCount - a.interactionCount).map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedStudentId(student.id);
                      setHistoryStudent(student);
                    }}
                  >
                    <td className="py-2 pl-4 pr-2 font-medium text-zinc-900 dark:text-zinc-100">{student.name}</td>
                    <td className="py-2 px-3 text-right font-mono">{student.interactionCount}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{student.cleared}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-600 dark:text-amber-400">{student.revisits}</td>
                    <td className="py-2 px-3 text-right font-mono">{student.lastInteractionDate}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-xs text-zinc-500">No student matches your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors shadow-2xs">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Selected Student Detail</div>
          {selectedStudentDetail ? (
            <div className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
              <div><span className="text-zinc-500">Name:</span> <strong className="text-zinc-900 dark:text-zinc-100">{selectedStudentDetail.name}</strong></div>
              <div><span className="text-zinc-500">Student ID:</span> <span className="font-mono text-zinc-900 dark:text-zinc-100">{selectedStudentDetail.id}</span></div>
              <div><span className="text-zinc-500">Total interactions:</span> <span className="font-mono text-zinc-900 dark:text-zinc-100">{selectedStudentDetail.interactionCount}</span></div>
              <div><span className="text-zinc-500">Cleared:</span> <span className="font-mono text-emerald-600 dark:text-emerald-400">{selectedStudentDetail.cleared}</span></div>
              <div><span className="text-zinc-500">Revisits:</span> <span className="font-mono text-amber-600 dark:text-amber-400">{selectedStudentDetail.revisits}</span></div>
              <div><span className="text-zinc-500">Last interaction:</span> <span className="font-mono text-zinc-900 dark:text-zinc-100">{selectedStudentDetail.lastInteractionDate}</span></div>
              <div><span className="text-zinc-500">Current status:</span> <span className="text-zinc-900 dark:text-zinc-100">{selectedStudentDetail.lastStatus}</span></div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Click a student row to view interaction count and basic status analytics.</p>
          )}
        </div>
      </div>

      <StudentHistoryModal
        isOpen={!!historyStudent}
        onClose={() => setHistoryStudent(null)}
        student={historyStudent}
        interactions={interactions}
        onStartNewInteraction={() => undefined}
      />
    </div>
  );
}
