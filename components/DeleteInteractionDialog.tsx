'use client';

import React, { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { InteractionLog } from '@/lib/types';

interface DeleteInteractionDialogProps {
  log: InteractionLog;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>; // rejects with the server's message on failure
}

const MIN_REASON = 5;

// "Are you sure?" step before deleting an interaction. A reason is required and is stored with the deleted record.
export function DeleteInteractionDialog({ log, onCancel, onConfirm }: DeleteInteractionDialogProps) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = reason.trim().length >= MIN_REASON;

  const confirm = () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    onConfirm(reason.trim()).catch((err: Error) => {
      setError(err.message);
      setBusy(false);
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-interaction-title">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 text-xs shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h2 id="delete-interaction-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Delete this interaction?</h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">{log.studentName}</strong> ({log.studentId}) · {log.date} ·{' '}
              {log.statusPostInteraction} · taken by {log.instructorName}
            </p>
            {log.topics && <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">Topics: {log.topics}</p>}
          </div>
        </div>

        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          It will be removed from the student&apos;s history, Today&apos;s Interactions and all counts, and the student&apos;s status will be recalculated.
        </p>

        <label htmlFor="delete-reason" className="mt-4 block font-medium text-zinc-700 dark:text-zinc-300">
          Why are you deleting it? <span className="text-rose-500">*</span>
        </label>
        <textarea
          id="delete-reason"
          rows={3}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Duplicate of the interaction logged on 22 Sep / wrong student / wrong details"
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        />
        {!ready && reason.length > 0 && <p className="mt-1 text-[11px] text-zinc-500">At least {MIN_REASON} characters.</p>}
        {error && <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-8 rounded-md border border-zinc-200 bg-white px-3 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!ready || busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete interaction
          </button>
        </div>
      </div>
    </div>
  );
}
