"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Student, InteractionLog, InstructorUser } from "@/lib/types";
import { getStoredStudents, getStoredInteractions, addInteractionLog, getInstructorSummaries, exportInteractionsToCSV, getStoredCurrentUser, clearStoredInstructorSession, instructorNamesMatch, saveStudents, getDefaultStepForLevel, getDefaultTopicForLevel } from "@/lib/storage";
import { Navbar } from "@/components/Navbar";
import { StudentRosterTable } from "@/components/StudentRosterTable";
import { InstructorLoginModal } from "@/components/InstructorLoginModal";
import { InteractionRoom } from "@/components/InteractionRoom";
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

  useEffect(() => {
    const user = getStoredCurrentUser();
    if (!user) { router.replace("/login"); return; }
    setCurrentUser(user);
    setAuthChecked(true);
  }, [router]);

  // Theme
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const saved = (localStorage.getItem("kkh_theme") as "light" | "dark") ?? "dark";
    setTheme(saved);
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, []);
  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("kkh_theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  };

  // App state
  const [students, setStudents] = useState<Student[]>(() => getStoredStudents());
  const [interactions, setInteractions] = useState<InteractionLog[]>(() => getStoredInteractions());
  const [activeTab, setActiveTab] = useState<"my-students" | "all-students" | "analytics" | "logs">("all-students");
  const [isInstructorModalOpen, setIsInstructorModalOpen] = useState(false);
  const [postInteractionStudent, setPostInteractionStudent] = useState<Student | null>(null);
  const [postInteractionDraft, setPostInteractionDraft] = useState<{ round: number; selectedTopics: string; questionsAskedList: string[]; notes: string; } | null>(null);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  const instructorSummaries = useMemo(() => getInstructorSummaries(students), [students]);
  const currentInstructor = currentUser?.name ?? "";
  const isAdmin = currentUser?.role === "admin";
  const assignedCount = useMemo(() => isAdmin ? students.length : students.filter((s) => instructorNamesMatch(s.instructor, currentInstructor)).length, [students, currentInstructor, isAdmin]);

  const handleLogout = () => { clearStoredInstructorSession(); router.replace("/login"); };
  const handleStartInteraction = (student: Student) => {
    setPostInteractionStudent(student);
    setPostInteractionDraft(null);
  };
  const handleSaveInteraction = (newLog: InteractionLog) => { const updated = addInteractionLog(newLog); setStudents([...updated.students]); setInteractions([...updated.interactions]); };
  const handleUpdateStudentLevel = (studentId: string, nextLevel: string) => {
    setStudents((prev) => {
      const updated = prev.map((student) => {
        if (student.id !== studentId) return student;
        const nextStep = student.currentStep && student.level === nextLevel
          ? student.currentStep
          : getDefaultStepForLevel(nextLevel);
        const nextTopic = student.currentTopic && student.level === nextLevel
          ? student.currentTopic
          : getDefaultTopicForLevel(nextLevel);
        return { ...student, level: nextLevel, currentStep: nextStep, currentTopic: nextTopic };
      });
      saveStudents(updated);
      return updated;
    });
  };
  const handleUpdateStudentStep = (studentId: string, nextStep: string) => {
    setStudents((prev) => {
      const updated = prev.map((student) => student.id === studentId ? { ...student, currentStep: nextStep } : student);
      saveStudents(updated);
      return updated;
    });
  };
  const handleUpdateStudentTopic = (studentId: string, nextTopic: string) => {
    setStudents((prev) => {
      const updated = prev.map((student) => student.id === studentId ? { ...student, currentTopic: nextTopic } : student);
      saveStudents(updated);
      return updated;
    });
  };
  const handleSelectInstructor = (name: string) => {
    setActiveTab("analytics");
    if (name && name !== 'Admin') {
      const target = students.find((s) => instructorNamesMatch(s.instructor, name));
      if (target) {
        // Keep the selected instructor visible in the analytics tab but do not lock the roster to only that instructor.
      }
    }
  };
  const handleExportCSV = () => exportInteractionsToCSV(interactions);

  if (!authChecked || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      <Navbar
        currentInstructor={currentInstructor}
        currentUser={currentUser}
        onOpenInstructorModal={() => setIsInstructorModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportCSV={handleExportCSV}
        onLogout={handleLogout}
        interactionCount={interactions.length}
        totalStudents={students.length}
        assignedCount={assignedCount}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isAdmin={isAdmin}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {activeTab === "my-students" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{isAdmin ? "Assigned Cohort View" : `Students assigned to ${currentInstructor}`}</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{isAdmin ? `${students.length} total assigned candidates` : `${assignedCount} candidates assigned to you`}</p>
            </div>
            <StudentRosterTable students={students} currentInstructor={currentInstructor} onStartInteraction={handleStartInteraction} onViewHistory={(s) => setHistoryStudent(s)} onUpdateStudentLevel={handleUpdateStudentLevel} onUpdateStudentStep={handleUpdateStudentStep} onUpdateStudentTopic={handleUpdateStudentTopic} isAllDirectory={false} />
          </div>
        )}
        {activeTab === "all-students" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Manager Dashboard <span className="text-sm font-normal text-zinc-400">{students.length} candidates</span></h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Full student directory with assigned instructor, current level, degree, section, and exam hall details for management review.</p>
            </div>
            <StudentRosterTable students={students} currentInstructor={currentInstructor} onStartInteraction={handleStartInteraction} onViewHistory={(s) => setHistoryStudent(s)} onUpdateStudentLevel={handleUpdateStudentLevel} onUpdateStudentStep={handleUpdateStudentStep} onUpdateStudentTopic={handleUpdateStudentTopic} isAllDirectory={true} />
          </div>
        )}
        {activeTab === "logs" && <InteractionLogsTable interactions={interactions} onExportCSV={handleExportCSV} currentInstructor={currentInstructor} />}
        {activeTab === "analytics" && <AnalyticsDashboard students={students} interactions={interactions} instructorSummaries={instructorSummaries} onExportCSV={handleExportCSV} onSelectInstructor={handleSelectInstructor} />}
      </main>
      <InstructorLoginModal isOpen={isInstructorModalOpen} onClose={() => setIsInstructorModalOpen(false)} currentInstructor={currentInstructor} onSelectInstructor={() => setIsInstructorModalOpen(false)} instructorSummaries={instructorSummaries} />
      <PostInteractionModal isOpen={!!postInteractionStudent} onClose={() => { setPostInteractionStudent(null); setPostInteractionDraft(null); }} student={postInteractionStudent} currentInstructor={currentInstructor} initialDraft={postInteractionDraft} onSave={handleSaveInteraction} />
      <StudentHistoryModal isOpen={!!historyStudent} onClose={() => setHistoryStudent(null)} student={historyStudent} interactions={interactions} onStartNewInteraction={handleStartInteraction} />
    </div>
  );
}
