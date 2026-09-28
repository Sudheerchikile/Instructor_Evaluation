'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { InstructorOption } from '@/lib/types';

interface InstructorPickerProps {
  options: InstructorOption[];
  value: string | null;              // selected instructor id
  onChange: (id: string) => void;
  loading?: boolean;
}

// Searchable single-select. Only listed instructors can be chosen, so every interaction is
// credited to a real instructor id (no free-text names).
export function InstructorPicker({ options, value, onChange, loading = false }: InstructorPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q) || o.firstName.toLowerCase().includes(q));
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
    setHighlight(Math.max(0, options.findIndex((o) => o.id === value)));
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const choose = (option: InstructorOption) => {
    onChange(option.id);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) choose(filtered[highlight]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        disabled={loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 text-left text-xs text-zinc-900 focus:border-zinc-400 focus:outline-hidden disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 cursor-pointer"
      >
        <span className={`truncate ${selected ? '' : 'text-zinc-400'}`}>
          {loading ? 'Loading instructors…' : selected ? selected.name : 'Select instructor'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </button>

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
              placeholder="Search instructor…"
              aria-label="Search instructor"
              className="h-8 w-full bg-transparent pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden dark:text-zinc-100"
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.map((option, index) => {
              const isSelected = option.id === value;
              return (
                <li
                  key={option.id}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(e) => { e.preventDefault(); choose(option); }}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-xs ${
                    index === highlight ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                  }`}
                >
                  <span className="truncate text-zinc-900 dark:text-zinc-100">{option.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {option.firstName !== option.name && <span className="text-[11px] text-zinc-400">{option.firstName}</span>}
                    {isSelected && <Check className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-300" />}
                  </span>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-3 py-3 text-center text-xs text-zinc-500">No instructor matches &quot;{query}&quot;.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
