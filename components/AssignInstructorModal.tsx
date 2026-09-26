"use client";

import React, { useState } from "react";
import { Student } from "@/lib/types";
import { X, UserCheck, Loader2, AlertCircle } from "lucide-react";

interface AssignInstructorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: Student[];
  instructors: string[];
  onAssigned: (studentIds: string[], instructorName: string) => void;
}

export function AssignInstructorModal({
  isOpen,
  onClose,
  selectedStudents,
  instructors,
  onAssigned,
}: AssignInstructorModalProps) {
  const [selectedInstructor, setSelectedInstructor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || selectedStudents.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedInstructor) {
      setError("Please select an instructor to assign.");
      return;
    }

    setLoading(true);
    try {
      const studentIds = selectedStudents.map((s) => s.id);
      const res = await fetch("/api/students/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds,
          instructorName: selectedInstructor,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to assign instructor.");
        return;
      }

      onAssigned(studentIds, selectedInstructor);
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "An error occurred while assigning instructor.");
    }
  };

  const inputStyle =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <UserCheck className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Assign Instructor ({selectedStudents.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Selected candidates ({selectedStudents.length}):
            </p>
            <div className="mt-1.5 max-h-24 overflow-y-auto space-y-1">
              {selectedStudents.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="font-mono text-zinc-400 text-[11px]">{s.id}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Select Instructor
            </label>
            <select
              value={selectedInstructor}
              onChange={(e) => setSelectedInstructor(e.target.value)}
              className={inputStyle}
              required
            >
              <option value="">-- Choose Instructor --</option>
              {instructors.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Confirm Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
