// Display helpers. All money is stored in USD cents on the server.

export function fmtUSD(cents, opts = {}) {
  const dollars = (cents ?? 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: opts.cents ? 2 : 0,
    minimumFractionDigits: opts.cents ? 2 : 0,
  }).format(dollars);
}

export function fmtIQD(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' IQD';
}

// USD cents → IQD, using a rate (IQD per 1 USD). Rounded to whole IQD.
export function usdCentsToIqd(cents, rate) {
  if (!rate || cents == null) return null;
  return Math.round((cents / 100) * rate);
}

// IQD amount → USD cents, using a rate.
export function iqdToUsdCents(iqd, rate) {
  if (!rate) return null;
  return Math.round((iqd / rate) * 100);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  // Server emits "YYYY-MM-DD" for effective_date and "YYYY-MM-DD HH:MM:SS" for created_at.
  const norm = iso.includes('T') ? iso : iso.replace(' ', 'T') + (iso.length === 10 ? 'T00:00:00' : '');
  const d = new Date(norm);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtRelativeDate(iso) {
  if (!iso) return '—';
  const norm = iso.includes('T') ? iso : iso.replace(' ', 'T') + (iso.length === 10 ? 'T00:00:00' : '');
  const d = new Date(norm);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return fmtDate(iso);
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
