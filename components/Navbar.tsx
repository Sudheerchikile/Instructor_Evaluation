"use client";

import React from "react";
import { Users, BarChart2, FileSpreadsheet, Download, UserCheck, Sun, Moon, Layers, LogOut, ShieldCheck, Contact } from "lucide-react";
import { InstructorUser } from "@/lib/types";

export type AppTab = "my-students" | "all-students" | "instructors" | "analytics" | "logs";

interface NavbarProps {
  currentInstructor: string;
  currentUser: InstructorUser;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onExportCSV: () => void;
  onLogout: () => void;
  interactionCount: number;
  totalStudents: number;
  assignedCount: number;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  isAdmin?: boolean;
}

export function Navbar({ currentInstructor, currentUser, activeTab, setActiveTab, onExportCSV, onLogout, interactionCount, totalStudents, assignedCount, theme = "dark", onToggleTheme = () => {}, isAdmin = false }: NavbarProps) {
  const initials = currentUser.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const tabCls = (t: string) => `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${activeTab === t ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`;
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 dark:border-zinc-800 dark:bg-zinc-950/95 backdrop-blur-xs transition-colors">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"><Layers className="h-4 w-4" /></div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">KKH DSA Evaluation</span>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">v2.4</span>
          </div>
        </div>
        <nav className="hidden md:flex items-center rounded-lg border border-zinc-200/90 bg-zinc-100/70 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <button onClick={() => setActiveTab("all-students")} className={tabCls("all-students")}><Users className="h-3.5 w-3.5" /><span>Directory</span><span className="ml-1 font-mono text-[11px] text-zinc-400">{totalStudents}</span></button>
          {/* Admins read everything but edit nothing, so they get the Instructor List instead of an Assigned page. */}
          {isAdmin ? (
            <button onClick={() => setActiveTab("instructors")} className={tabCls("instructors")}><Contact className="h-3.5 w-3.5" /><span>Instructors</span></button>
          ) : (
            <button onClick={() => setActiveTab("my-students")} className={tabCls("my-students")}><UserCheck className="h-3.5 w-3.5" /><span>Assigned</span><span className="ml-1 font-mono text-[11px] text-zinc-400">{assignedCount}</span></button>
          )}
          <button onClick={() => setActiveTab("analytics")} className={tabCls("analytics")}><BarChart2 className="h-3.5 w-3.5" /><span>Analytics</span></button>
          <button onClick={() => setActiveTab("logs")} className={tabCls("logs")}><FileSpreadsheet className="h-3.5 w-3.5" /><span>Today&apos;s Interactions</span><span className="ml-1 font-mono text-[11px] text-zinc-400">{interactionCount}</span></button>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onToggleTheme} title="Toggle theme" className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onExportCSV} className="hidden sm:inline-flex items-center gap-1.5 h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
            <Download className="h-3.5 w-3.5" /><span>Export</span>
          </button>
          <div className="flex items-center gap-1.5 h-8 rounded-md border border-zinc-200 bg-white pl-2 pr-1 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-zinc-100 text-[10px] font-mono font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">{initials}</div>
            <div className="hidden sm:flex flex-col items-start leading-none px-1">
              <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 max-w-[110px] truncate">{currentUser.name}</span>
              {isAdmin && <span className="flex items-center gap-0.5 text-[10px] text-zinc-400"><ShieldCheck className="h-2.5 w-2.5" />Admin</span>}
            </div>
            <button onClick={onLogout} title="Sign out" className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
