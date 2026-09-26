"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Student, InteractionLog, InstructorUser, InstructorSummary } from "@/lib/types";
import { getStoredCurrentUser, clearStoredInstructorSession, instructorNamesMatch, getDefaultStepForLevel, getDefaultTopicForLevel, exportInteractionsToCSV } from "@/lib/storage";
import { Navbar } from "@/components/Navbar";
import { StudentRosterTable } from "@/components/StudentRosterTable";
import { InstructorLoginModal } from "@/components/InstructorLoginModal";
import { PostInteractionModal } from "@/components/PostInteractionModal";
import { StudentHistoryModal } from "@/components/StudentHistoryModal";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { InteractionLogsTable } from "@/components/InteractionLogsTable";
import { AddStudentModal } from "@/components/AddStudentModal";
import { AssignInstructorModal } from "@/components/AssignInstructorModal";
import { Loader2, Plus, UserCheck } from "lucide-react";

export default function Home() {
  const router = useRouter();

  // Auth gate
  const [currentUser, setCurrentUser] = useState<InstructorUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
        } else {
          // Fallback to stored user if session exists
          const localUser = getStoredCurrentUser();
          if (localUser) {
            setCurrentUser(localUser);
          } else {
            router.replace("/login");
            return;
          }
        }
      } catch (err) {
        const localUser = getStoredCurrentUser();
        if (localUser) {
          setCurrentUser(localUser);
        } else {
          router.replace("/login");
          return;
        }
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
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

  // App data state loaded from PostgreSQL DB APIs
  const [students, setStudents] = useState<Student[]>([]);
  const [interactions, setInteractions] = useState<InteractionLog[]>([]);
  const [instructorSummaries, setInstructorSummaries] = useState<InstructorSummary[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState<"my-students" | "all-students" | "analytics" | "logs">("all-students");
  const [isInstructorModalOpen, setIsInstructorModalOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const [postInteractionStudent, setPostInteractionStudent] = useState<Student | null>(null);
  const [postInteractionDraft, setPostInteractionDraft] = useState<{ round: number; selectedTopics: string; questionsAskedList: string[]; notes: string; } | null>(null);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  // Load backend data from PostgreSQL via Next.js API endpoints
  const refreshBackendData = async () => {
    try {
      setLoadingData(true);
      const [studentsRes, interactionsRes, instructorsRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/interactions"),
        fetch("/api/instructors"),
      ]);

      const studentsData = await studentsRes.json();
      const interactionsData = await interactionsRes.json();
      const instructorsData = await instructorsRes.json();

      if (studentsData.success) {
        setStudents(studentsData.students || []);
      }
      if (interactionsData.success) {
        setInteractions(interactionsData.interactions || []);
      }
      if (instructorsData.success) {
        setInstructorSummaries(instructorsData.summaries || []);
      }
    } catch (err) {
      console.error("Error loading backend data from PostgreSQL:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (authChecked && currentUser) {
      refreshBackendData();
    }
  }, [authChecked, currentUser]);

  const currentInstructor = currentUser?.name ?? "";
  const isAdmin = currentUser?.role === "admin";
  const assignedCount = useMemo(
    () => (isAdmin ? students.length : students.filter((s) => instructorNamesMatch(s.instructor, currentInstructor)).length),
    [students, currentInstructor, isAdmin]
  );

  const instructorNameList = useMemo(
    () => Array.from(new Set(instructorSummaries.map((s) => s.name).filter(Boolean))),
    [instructorSummaries]
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    clearStoredInstructorSession();
    router.replace("/login");
  };

  const handleStartInteraction = (student: Student) => {
    setPostInteractionStudent(student);
    setPostInteractionDraft(null);
  };

  // Save new interaction log to PostgreSQL DB via API
  const handleSaveInteraction = async (newLog: InteractionLog) => {
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLog),
      });

      const data = await res.json();
      if (data.success && data.log && data.student) {
        setInteractions((prev) => [data.log, ...prev]);
        setStudents((prev) => prev.map((s) => (s.id === data.student.id ? data.student : s)));
        refreshBackendData();
      }
    } catch (err) {
      console.error("Failed to save interaction to PostgreSQL:", err);
    }
  };

  // Update student level in PostgreSQL DB
  const handleUpdateStudentLevel = async (studentId: string, nextLevel: string) => {
    const target = students.find((s) => s.id === studentId);
    if (!target) return;

    const nextStep = target.currentStep && target.level === nextLevel ? target.currentStep : getDefaultStepForLevel(nextLevel);
    const nextTopic = target.currentTopic && target.level === nextLevel ? target.currentTopic : getDefaultTopicForLevel(nextLevel);

    // Optimistic UI update
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, level: nextLevel, currentStep: nextStep, currentTopic: nextTopic } : s))
    );

    try {
      await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: nextLevel, currentStep: nextStep, currentTopic: nextTopic }),
      });
    } catch (err) {
      console.error("Failed to update student level in PostgreSQL:", err);
    }
  };

  // Update student step in PostgreSQL DB
  const handleUpdateStudentStep = async (studentId: string, nextStep: string) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, currentStep: nextStep } : s)));
    try {
      await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStep: nextStep }),
      });
    } catch (err) {
      console.error("Failed to update student step in PostgreSQL:", err);
    }
  };

  // Update student topic in PostgreSQL DB
  const handleUpdateStudentTopic = async (studentId: string, nextTopic: string) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, currentTopic: nextTopic } : s)));
    try {
      await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentTopic: nextTopic }),
      });
    } catch (err) {
      console.error("Failed to update student topic in PostgreSQL:", err);
    }
  };

  const handleSelectInstructor = (name: string) => {
    setActiveTab("analytics");
  };

  const handleExportCSV = () => exportInteractionsToCSV(interactions);

  const handleStudentAdded = (newStudent: Student) => {
    setStudents((prev) => [newStudent, ...prev]);
    refreshBackendData();
  };

  const handleAssigned = (studentIds: string[], instructorName: string) => {
    setStudents((prev) =>
      prev.map((s) => (studentIds.includes(s.id) ? { ...s, instructor: instructorName } : s))
    );
    refreshBackendData();
  };

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
        {loadingData && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
            <span>Syncing live data from PostgreSQL database...</span>
          </div>
        )}

        {activeTab === "my-students" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {isAdmin ? "Assigned Cohort View" : `Students assigned to ${currentInstructor}`}
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {isAdmin
                    ? `${students.length} total assigned candidates in PostgreSQL database`
                    : `${assignedCount} candidates assigned to you`}
                </p>
              </div>
              <button
                onClick={() => setIsAddStudentOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Add Candidate</span>
              </button>
            </div>

            <StudentRosterTable
              students={students}
              currentInstructor={currentInstructor}
              onStartInteraction={handleStartInteraction}
              onViewHistory={(s) => setHistoryStudent(s)}
              onUpdateStudentLevel={handleUpdateStudentLevel}
              onUpdateStudentStep={handleUpdateStudentStep}
              onUpdateStudentTopic={handleUpdateStudentTopic}
              isAllDirectory={false}
            />
          </div>
        )}

        {activeTab === "all-students" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Manager Dashboard <span className="text-sm font-normal text-zinc-400">{students.length} candidates</span>
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Full student directory with assigned instructor, current level, degree, section, and exam hall details stored in Neon PostgreSQL database.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddStudentOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Candidate</span>
                </button>
              </div>
            </div>

            <StudentRosterTable
              students={students}
              currentInstructor={currentInstructor}
              onStartInteraction={handleStartInteraction}
              onViewHistory={(s) => setHistoryStudent(s)}
              onUpdateStudentLevel={handleUpdateStudentLevel}
              onUpdateStudentStep={handleUpdateStudentStep}
              onUpdateStudentTopic={handleUpdateStudentTopic}
              isAllDirectory={true}
            />
          </div>
        )}

        {activeTab === "logs" && (
          <InteractionLogsTable
            interactions={interactions}
            onExportCSV={handleExportCSV}
            currentInstructor={currentInstructor}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsDashboard
            students={students}
            interactions={interactions}
            instructorSummaries={instructorSummaries}
            onExportCSV={handleExportCSV}
            onSelectInstructor={handleSelectInstructor}
          />
        )}
      </main>

      <InstructorLoginModal
        isOpen={isInstructorModalOpen}
        onClose={() => setIsInstructorModalOpen(false)}
        currentInstructor={currentInstructor}
        onSelectInstructor={() => setIsInstructorModalOpen(false)}
        instructorSummaries={instructorSummaries}
      />

      <PostInteractionModal
        isOpen={!!postInteractionStudent}
        onClose={() => {
          setPostInteractionStudent(null);
          setPostInteractionDraft(null);
        }}
        student={postInteractionStudent}
        currentInstructor={currentInstructor}
        initialDraft={postInteractionDraft}
        onSave={handleSaveInteraction}
      />

      <StudentHistoryModal
        isOpen={!!historyStudent}
        onClose={() => setHistoryStudent(null)}
        student={historyStudent}
        interactions={interactions}
        onStartNewInteraction={handleStartInteraction}
      />

      <AddStudentModal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        onStudentAdded={handleStudentAdded}
        instructors={instructorNameList}
      />

      <AssignInstructorModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        selectedStudents={[]}
        instructors={instructorNameList}
        onAssigned={handleAssigned}
      />
    </div>
  );
}
