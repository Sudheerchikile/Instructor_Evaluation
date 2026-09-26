"use client";

import React, { useState } from "react";
import { Student } from "@/lib/types";
import { X, UserPlus, Loader2, AlertCircle } from "lucide-react";

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: (student: Student) => void;
  instructors: string[];
}

export function AddStudentModal({
  isOpen,
  onClose,
  onStudentAdded,
  instructors,
}: AddStudentModalProps) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [degree, setDegree] = useState("BITS");
  const [section, setSection] = useState("S001");
  const [level, setLevel] = useState("Level 0");
  const [hall, setHall] = useState("Hall 1");
  const [instructor, setInstructor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!id.trim() || !name.trim()) {
      setError("Candidate ID and Full Name are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim(),
          name: name.trim(),
          degree,
          section,
          level,
          hall,
          instructor: instructor || "Unassigned",
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to add student.");
        return;
      }

      onStudentAdded(data.student);
      // Reset form
      setId("");
      setName("");
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "An error occurred while adding student.");
    }
  };

  const inputStyle =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <UserPlus className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Add New Candidate
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Candidate ID *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. N24H01A0999"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className={inputStyle}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Degree
              </label>
              <select
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                className={inputStyle}
              >
                <option value="BITS">BITS</option>
                <option value="B.Tech CS">B.Tech CS</option>
                <option value="B.Tech IT">B.Tech IT</option>
                <option value="BCA">BCA</option>
                <option value="MCA">MCA</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Section
              </label>
              <input
                type="text"
                placeholder="e.g. S001"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Starting Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className={inputStyle}
              >
                <option value="Level 0">Level 0</option>
                <option value="Level 1">Level 1</option>
                <option value="Level 2">Level 2</option>
                <option value="Level 3">Level 3</option>
                <option value="Level 4">Level 4</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Examination Hall
              </label>
              <input
                type="text"
                placeholder="e.g. Hall 1"
                value={hall}
                onChange={(e) => setHall(e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Assigned Instructor
            </label>
            <select
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              className={inputStyle}
            >
              <option value="">Unassigned</option>
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
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Add Candidate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
