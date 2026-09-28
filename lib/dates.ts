// Calendar dates in the user's timezone as YYYY-MM-DD (toISOString would give the UTC date,
// which is "yesterday" in India before 5:30 am).

function formatLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal(): string {
  return formatLocal(new Date());
}

// Local calendar date of an ISO timestamp such as InteractionLog.createdAt.
export function localDateOf(isoTimestamp: string | undefined): string {
  const date = isoTimestamp ? new Date(isoTimestamp) : null;
  return date && !Number.isNaN(date.getTime()) ? formatLocal(date) : '';
}
