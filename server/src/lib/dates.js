// Date helpers. All "month" values are YYYY-MM strings, "date" is YYYY-MM-DD.
// Times are server-local — fine for a family app pinned to one timezone.

export function todayISO() {
  const d = new Date();
  return ymd(d);
}

export function currentMonth() {
  return todayISO().slice(0, 7);
}

export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Returns { start, endExclusive } as YYYY-MM-DD strings.
// endExclusive is the first day of the following month — use < endExclusive
// in queries so we don't worry about last-day-of-month edge cases.
export function monthBounds(month) {
  const [y, m] = month.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, endExclusive: next };
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function daysElapsedInMonth(month) {
  const today = new Date();
  const [y, m] = month.split('-').map(Number);
  if (today.getFullYear() !== y || today.getMonth() + 1 !== m) {
    // If the month is in the past, the whole month has elapsed.
    const todayMonth = currentMonth();
    return todayMonth > month ? daysInMonth(month) : 0;
  }
  return today.getDate();
}
