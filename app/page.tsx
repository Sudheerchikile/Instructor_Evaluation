"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Student, InteractionLog, InstructorUser, InstructorOption } from "@/lib/types";
import { getInstructorSummaries, exportInteractionsToCSV, isStudentAssignedTo } from "@/lib/storage";
import { coerceStep, getDefaultStepForLevel, getDefaultTopicForLevel } from "@/lib/multiLevelCurriculum";
import { ApiError, createInteraction, fetchCurrentUser, fetchInstructorOptions, fetchInteractions, fetchStudents, signOut, updateInteraction, updateStudentProgress } from "@/lib/api";
import { AppTab, Navbar } from "@/components/Navbar";
import { InstructorDirectoryTable } from "@/components/InstructorDirectoryTable";
import { localDateOf, todayLocal } from "@/lib/dates";
import { StudentRosterTable } from "@/components/StudentRosterTable";
import { PostInteractionModal } from "@/components/PostInteractionModal";
import { StudentHistoryModal } from "@/components/StudentHistoryModal";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { InteractionLogsTable } from "@/components/InteractionLogsTable";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  // Auth gate
  const [currentUser, setCurrentUser] = useState<InstructorUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("all-students");

  // The session lives in an httpOnly cookie; the server tells us who is signed in.
  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        if (user.role === "instructor") setActiveTab("my-students");
        setAuthChecked(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  // Theme
  // Read the saved theme on first client render. Safe for hydration: the first render is the
  // session loader, which doesn't depend on the theme.
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" && localStorage.getItem("kkh_theme") === "light" ? "light" : "dark"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("kkh_theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  };

  // App state
  // Students and interactions come from PostgreSQL via /api; every change is saved there.
  const [students, setStudents] = useState<Student[]>([]);
  const [interactions, setInteractions] = useState<InteractionLog[]>([]);
  const [instructorOptions, setInstructorOptions] = useState<InstructorOption[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (!authChecked) return;
    let cancelled = false;
    Promise.all([fetchStudents(), fetchInteractions(), fetchInstructorOptions()])
      .then(([loadedStudents, loadedInteractions, loadedInstructors]) => {
        if (cancelled) return;
        setStudents(loadedStudents);
        setInteractions(loadedInteractions);
        setInstructorOptions(loadedInstructors);
        setDataLoaded(true);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else setDataError(`Could not load data: ${err.message}`);
      });
    return () => { cancelled = true; };
  }, [authChecked, router]);
  const [postInteractionStudent, setPostInteractionStudent] = useState<Student | null>(null);
  const [editingLog, setEditingLog] = useState<InteractionLog | null>(null);
  const [postInteractionDraft, setPostInteractionDraft] = useState<{ round: number; selectedTopics: string; questionsAskedList: string[]; notes: string; } | null>(null);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  const instructorSummaries = useMemo(() => getInstructorSummaries(students), [students]);
  const currentInstructor = currentUser?.name ?? "";
  const isAdmin = currentUser?.role === "admin";
  const assignedCount = useMemo(() => isAdmin ? students.length : students.filter((s) => isStudentAssignedTo(s, currentUser)).length, [students, currentUser, isAdmin]);

  const handleLogout = () => { signOut().catch(() => {}).finally(() => router.replace("/login")); };
  const handleStartInteraction = (student: Student) => {
    setEditingLog(null);
    setPostInteractionStudent(student);
    setPostInteractionDraft(null);
  };

  // Same rule as the server: the student's assigned instructor, or whoever logged it. Admins are read-only.
  const canEditInteraction = (log: InteractionLog) => {
    if (!currentUser || currentUser.role !== "instructor") return false;
    const student = students.find((s) => s.id === log.studentId);
    return (!!student?.instructorId && student.instructorId === currentUser.instructorId) || log.createdBy === currentUser.id;
  };
  const handleEditInteraction = (log: InteractionLog) => {
    const student = students.find((s) => s.id === log.studentId);
    if (!student) return;
    setHistoryStudent(null);
    setEditingLog(log);
    setPostInteractionStudent(student);
  };
  const closeInteractionForm = () => { setPostInteractionStudent(null); setPostInteractionDraft(null); setEditingLog(null); };
  const replaceStudent = (updated: Student) => setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

  const handleSaveInteraction = (newLog: InteractionLog) => {
    setDataError(null);
    if (editingLog) {
      updateInteraction(editingLog.id, newLog)
        .then(({ student, interaction }) => {
          replaceStudent(student);
          setInteractions((prev) => prev.map((l) => (l.id === interaction.id ? interaction : l)));
        })
        .catch((err: Error) => setDataError(`Changes for ${newLog.studentName} were not saved: ${err.message}`));
      return;
    }
    createInteraction(newLog)
      .then(({ student, interaction }) => {
        replaceStudent(student);
        setInteractions((prev) => [interaction, ...prev]);
      })
      .catch((err: Error) => setDataError(`Interaction for ${newLog.studentName} was not saved: ${err.message}`));
  };

  // Optimistic update: the change shows at once in "My Students" and the directory, then is saved to the DB.
  // The server's copy replaces it on success; on failure the previous values are restored.
  const saveProgress = (studentId: string, patch: { level?: string; currentTopic?: string; currentStep?: string }) => {
    const previous = students.find((s) => s.id === studentId);
    if (!previous) return;

    const level = patch.level ?? previous.level;
    const currentTopic = patch.currentTopic ?? (patch.level ? getDefaultTopicForLevel(level) : previous.currentTopic ?? getDefaultTopicForLevel(level));
    const currentStep = patch.currentStep ?? (patch.level ? getDefaultStepForLevel(level) : coerceStep(level, currentTopic, previous.currentStep));
    const next = { level, currentTopic, currentStep };

    setDataError(null);
    replaceStudent({ ...previous, ...next });
    updateStudentProgress(studentId, next)
      .then(replaceStudent)
      .catch((err: Error) => {
        replaceStudent(previous);
        setDataError(`Change for ${previous.name} was not saved: ${err.message}`);
      });
  };
  const handleUpdateStudentLevel = (studentId: string, nextLevel: string) => saveProgress(studentId, { level: nextLevel });
  const handleUpdateStudentStep = (studentId: string, nextStep: string) => saveProgress(studentId, { currentStep: nextStep });
  const handleUpdateStudentTopic = (studentId: string, nextTopic: string) => saveProgress(studentId, { currentTopic: nextTopic });
  const handleSelectInstructor = () => {
    setActiveTab("analytics");
  };
  const handleExportCSV = () => exportInteractionsToCSV(interactions);

  // "Today's Interactions" page only: every instructor's interactions dated today or logged today.
  const todaysLogs = useMemo(() => {
    const today = todayLocal();
    return interactions.filter((log) => log.date === today || localDateOf(log.createdAt) === today);
  }, [interactions]);

  if (!authChecked || !currentUser || (!dataLoaded && !dataError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{authChecked ? "Loading students..." : "Verifying session..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      <Navbar
        currentInstructor={currentInstructor}
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportCSV={handleExportCSV}
        onLogout={handleLogout}
        interactionCount={todaysLogs.length}
        totalStudents={students.length}
        assignedCount={assignedCount}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isAdmin={isAdmin}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {dataError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {dataError}
          </div>
        )}
        {activeTab === "my-students" && !isAdmin && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Students assigned to {currentInstructor}</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{assignedCount} candidates assigned to you. Only you can update their level, topic, step and interactions.</p>
            </div>
            <StudentRosterTable students={students} currentInstructor={currentInstructor} currentInstructorEmail={currentUser.email} onStartInteraction={handleStartInteraction} onViewHistory={(s) => setHistoryStudent(s)} onUpdateStudentLevel={handleUpdateStudentLevel} onUpdateStudentStep={handleUpdateStudentStep} onUpdateStudentTopic={handleUpdateStudentTopic} isAllDirectory={false} />
          </div>
        )}
        {activeTab === "all-students" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Manager Dashboard <span className="text-sm font-normal text-zinc-400">{students.length} candidates</span></h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Full student directory with assigned instructor, current level, degree, section, and exam hall details for management review.</p>
            </div>
            <StudentRosterTable students={students} currentInstructor={currentInstructor} currentInstructorEmail={currentUser.email} onStartInteraction={handleStartInteraction} onViewHistory={(s) => setHistoryStudent(s)} onUpdateStudentLevel={handleUpdateStudentLevel} onUpdateStudentStep={handleUpdateStudentStep} onUpdateStudentTopic={handleUpdateStudentTopic} isAllDirectory={true} />
          </div>
        )}
        {activeTab === "instructors" && isAdmin && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Instructors</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Every instructor with full name, company email and assigned students. Click a row to see their students.</p>
            </div>
            <InstructorDirectoryTable students={students} onChanged={() => { fetchStudents().then(setStudents).catch(() => {}); }} />
          </div>
        )}
        {activeTab === "logs" && <InteractionLogsTable interactions={todaysLogs} onExportCSV={() => exportInteractionsToCSV(todaysLogs)} currentInstructor={currentInstructor} canEdit={canEditInteraction} onEdit={handleEditInteraction} />}
        {activeTab === "analytics" && <AnalyticsDashboard students={students} interactions={interactions} instructorSummaries={instructorSummaries} onExportCSV={handleExportCSV} onSelectInstructor={handleSelectInstructor} currentInstructorId={currentUser.instructorId} />}
      </main>
      {postInteractionStudent && (
        <PostInteractionModal key={editingLog?.id ?? postInteractionStudent.id} isOpen onClose={closeInteractionForm} editing={editingLog} student={postInteractionStudent} currentInstructorId={currentUser.instructorId} instructorOptions={instructorOptions} initialDraft={postInteractionDraft} onSave={handleSaveInteraction} />
      )}
      <StudentHistoryModal
        isOpen={!!historyStudent}
        onClose={() => setHistoryStudent(null)}
        student={historyStudent}
        interactions={interactions}
        onStartNewInteraction={handleStartInteraction}
        canLogInteraction={!isAdmin && activeTab === "my-students"}
        canEdit={canEditInteraction}
        onEdit={handleEditInteraction}
      />
    </div>
  );
}
