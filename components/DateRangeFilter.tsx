'use client';

import React, { useState } from 'react';
import { todayLocal } from '@/lib/dates';

// Optional inclusive date range on interaction dates (YYYY-MM-DD). Either end may be left open; a reversed range is
// read the right way round. Used by the student and instructor history popups.
export function useDateRange() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [from, to] = fromDate && toDate && fromDate > toDate ? [toDate, fromDate] : [fromDate, toDate];
  const hasRange = !!(from || to);
  const label = from && to ? (from === to ? from : `${from} to ${to}`) : from ? `from ${from}` : to ? `up to ${to}` : 'on any date';
  return {
    fromDate, toDate, setFromDate, setToDate, hasRange, label,
    includes: (date: string) => (!from || date >= from) && (!to || date <= to),
    clear: () => { setFromDate(''); setToDate(''); },
  };
}

export type DateRange = ReturnType<typeof useDateRange>;

// From / to pickers plus "All dates" once a range is set. Styled for the dark history popups.
export function DateRangeFilter({ range, idPrefix }: { range: DateRange; idPrefix: string }) {
  const today = todayLocal();
  const inputClass = 'h-8 rounded-md border border-[#373e47] bg-[#1c2128] px-2 text-xs text-[#cdd9e5] [color-scheme:dark] focus:border-[#545d68] focus:outline-hidden cursor-pointer';
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#909dab]">
      <label htmlFor={`${idPrefix}-from`}>From</label>
      <input id={`${idPrefix}-from`} type="date" value={range.fromDate} max={today} onChange={(e) => range.setFromDate(e.target.value)} className={inputClass} />
      <label htmlFor={`${idPrefix}-to`}>to</label>
      <input id={`${idPrefix}-to`} type="date" value={range.toDate} max={today} onChange={(e) => range.setToDate(e.target.value)} className={inputClass} />
      {range.hasRange && (
        <button
          type="button"
          onClick={range.clear}
          className="h-8 rounded-md border border-[#373e47] bg-[#2d333b] px-2.5 text-[11px] font-medium text-[#adbac7] hover:bg-[#373e47] hover:text-[#cdd9e5] transition-colors cursor-pointer"
        >
          All dates
        </button>
      )}
    </div>
  );
}
