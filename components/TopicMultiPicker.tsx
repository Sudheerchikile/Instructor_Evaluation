'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

interface TopicMultiPickerProps {
  options: string[];                 // topics of the student's level
  value: string[];                   // selected topics, in selection order
  onChange: (topics: string[]) => void;
  invalid?: boolean;
}

// Searchable multi-select. The list stays open while ticking topics; click outside or press Escape to close.
// Selected values not in `options` (e.g. free text from older logs) are kept and shown as chips.
export function TopicMultiPicker({ options, value, onChange, invalid = false }: TopicMultiPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row visible while moving with the keyboard.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const openList = () => {
    setQuery('');
    setHighlight(0);
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const toggle = (topic: string) => {
    onChange(value.includes(topic) ? value.filter((t) => t !== topic) : [...value, topic]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) toggle(filtered[highlight]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  return (
    <div ref={rootRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (open) { setOpen(false); } else { openList(); } } }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex min-h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-white px-2 py-1 text-left text-xs text-zinc-900 focus:outline-hidden dark:bg-zinc-900 dark:text-zinc-100 ${
          invalid ? 'border-rose-500' : 'border-zinc-200 focus:border-zinc-400 dark:border-zinc-800'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1">
          {value.length === 0 && <span className="px-1 text-zinc-400">Select topics covered</span>}
          {value.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {topic}
              <button
                type="button"
                aria-label={`Remove ${topic}`}
                onClick={(e) => { e.stopPropagation(); toggle(topic); }}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="relative border-b border-zinc-200 dark:border-zinc-800">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
              onKeyDown={onKeyDown}
              placeholder="Search topic…"
              aria-label="Search topic"
              className="h-8 w-full bg-transparent pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden dark:text-zinc-100"
            />
          </div>
          <ul ref={listRef} role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto py-1">
            {filtered.map((topic, index) => {
              const isSelected = value.includes(topic);
              return (
                <li
                  key={topic}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(e) => { e.preventDefault(); toggle(topic); }}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs ${
                    index === highlight ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <span className="truncate text-zinc-900 dark:text-zinc-100">{topic}</span>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-3 py-3 text-center text-xs text-zinc-500">No topic matches &quot;{query}&quot;.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
