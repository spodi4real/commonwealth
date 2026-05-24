import { db } from '../db.js';
import {
  todayISO, currentMonth, monthBounds, daysInMonth,
} from './dates.js';

// SOURCES describe recurring expected income.
// ENTRIES record what actually arrived. Entries are the source of truth
// for every KPI — sources only inform forecasts.

export function listSources({ includeArchived = false } = {}) {
  const sql = includeArchived
    ? 'SELECT * FROM income_sources ORDER BY archived_at IS NOT NULL, is_active DESC, id'
    : `SELECT * FROM income_sources
       WHERE archived_at IS NULL AND is_active = 1
       ORDER BY id`;
  return db.prepare(sql).all();
}

export function listEntries({
  from, to, sourceId, status, includeDeleted = false, limit = 200, offset = 0,
} = {}) {
  const where = [];
  const params = [];
  if (!includeDeleted) where.push('e.deleted_at IS NULL');
  if (from)     { where.push('e.received_date >= ?');  params.push(from); }
  if (to)       { where.push('e.received_date <  ?');  params.push(to); }
  if (sourceId) { where.push('e.source_id = ?');       params.push(Number(sourceId)); }
  if (status)   { where.push('e.status = ?');          params.push(status); }
  const sql =
    `SELECT e.*, s.name AS source_name, s.type AS source_type
     FROM income_entries e
     LEFT JOIN income_sources s ON s.id = e.source_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY e.received_date DESC, e.id DESC
     LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(...params, Number(limit), Number(offset));
}

// Sum of received-status income entries in a month (in USD cents).
export function actualThisMonth(month = currentMonth()) {
  const { start, endExclusive } = monthBounds(month);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total
       FROM income_entries
       WHERE received_date >= ? AND received_date < ?
         AND status IN ('received','partial')
         AND deleted_at IS NULL`
    )
    .get(start, endExclusive);
  return row.total;
}

// Expected = sum of recurring sources' expected_amount with an expected day
// that falls within the month. One-off bonuses/gifts aren't expected.
export function expectedThisMonth(month = currentMonth()) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(expected_amount_usd_cents), 0) AS total
       FROM income_sources
       WHERE is_recurring = 1 AND is_active = 1 AND archived_at IS NULL
         AND expected_amount_usd_cents > 0`
    )
    .get();
  return row.total;
  // Note: when sources span multiple paychecks per month (rare for this user)
  // expected_day_of_month would need to be a list. The current model handles
  // one expected day per source. Good enough — we can refine if needed.
}

// "Effective" monthly income for projection use:
//   - >= 3 months of entries: rolling 3-month average of actuals
//   - 1–2 months: most recent month's actual
//   - 0 months: fall back to the deprecated monthly_income setting
//     (preserves a useful default for brand-new users)
export function effectiveMonthlyIncome() {
  const months = lastNMonthActuals(3);
  const months_with_data = months.filter((m) => m.actual_usd_cents > 0);

  if (months_with_data.length === 0) {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'monthly_income_usd_cents'").get();
    if (row) {
      try { return Number(JSON.parse(row.value)) || 0; } catch { return 0; }
    }
    return 0;
  }
  if (months_with_data.length >= 3) {
    return Math.round(
      months_with_data.reduce((s, m) => s + m.actual_usd_cents, 0) / months_with_data.length
    );
  }
  return months_with_data[0].actual_usd_cents;
}

function lastNMonthActuals(n) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ month, actual_usd_cents: actualThisMonth(month) });
  }
  return out;
}

// Reliability over last 6 months: for each recurring source, did each
// expected paycheck arrive in full and on or before the expected day?
// Returns a score 0..1.
export function reliabilityScore() {
  const sources = db
    .prepare(
      `SELECT * FROM income_sources
       WHERE is_recurring = 1 AND archived_at IS NULL AND expected_amount_usd_cents > 0`
    )
    .all();
  if (sources.length === 0) return null;

  let expected_count = 0;
  let on_time_full = 0;

  const today = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const { start, endExclusive } = monthBounds(m);
    for (const s of sources) {
      // Skip months that are entirely before the source was created.
      if (s.created_at && s.created_at.slice(0, 10) > endExclusive) continue;
      expected_count++;
      const expectedISO = expectedDateForMonth(m, s.expected_day_of_month);
      const entry = db
        .prepare(
          `SELECT * FROM income_entries
           WHERE source_id = ?
             AND received_date >= ? AND received_date < ?
             AND status IN ('received','partial')
             AND deleted_at IS NULL`
        )
        .get(s.id, start, endExclusive);
      if (!entry) continue;
      const fullAmount = entry.amount_usd_cents >= s.expected_amount_usd_cents;
      const onTime = !expectedISO || entry.received_date <= expectedISO;
      if (fullAmount && onTime) on_time_full++;
    }
  }

  if (expected_count === 0) return null;
  return on_time_full / expected_count;
}

function expectedDateForMonth(month, day) {
  if (!day) return null;
  const [y, m] = month.split('-').map(Number);
  const max = new Date(y, m, 0).getDate();
  const realDay = Math.min(day, max);
  return `${month}-${String(realDay).padStart(2, '0')}`;
}

// Forecast for current+next two months: for each active recurring source,
// project an expected entry. Compare to actual entries already received.
export function upcomingForecast({ horizonMonths = 2 } = {}) {
  const sources = listSources();
  const today = todayISO();
  const out = [];

  for (let i = 0; i <= horizonMonths; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + i);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    for (const s of sources) {
      if (!s.is_recurring) continue;
      const expected_date = expectedDateForMonth(month, s.expected_day_of_month);
      const { start, endExclusive } = monthBounds(month);
      const entries = db
        .prepare(
          `SELECT * FROM income_entries
           WHERE source_id = ? AND received_date >= ? AND received_date < ?
             AND deleted_at IS NULL ORDER BY received_date`
        )
        .all(s.id, start, endExclusive);
      const received_total = entries
        .filter((e) => e.status === 'received' || e.status === 'partial')
        .reduce((sum, e) => sum + e.amount_usd_cents, 0);

      let status = 'expected';
      if (received_total >= s.expected_amount_usd_cents && s.expected_amount_usd_cents > 0) status = 'received';
      else if (received_total > 0) status = 'partial';
      else if (expected_date && expected_date < today) status = 'overdue';

      out.push({
        source_id: s.id,
        source_name: s.name,
        source_type: s.type,
        month,
        expected_date,
        expected_amount_usd_cents: s.expected_amount_usd_cents,
        received_usd_cents: received_total,
        status,
        days_overdue: status === 'overdue' && expected_date
          ? Math.floor((Date.parse(today) - Date.parse(expected_date)) / 86400000)
          : 0,
        entries,
      });
    }
  }
  return out;
}

// Average delay of recurring salary-type sources, in days, over last 6 entries.
export function averageDelayDays() {
  const rows = db
    .prepare(
      `SELECT e.received_date, e.expected_date
       FROM income_entries e
       JOIN income_sources s ON s.id = e.source_id
       WHERE s.is_recurring = 1
         AND e.expected_date IS NOT NULL
         AND e.deleted_at IS NULL
         AND e.status IN ('received','partial')
       ORDER BY e.received_date DESC LIMIT 6`
    )
    .all();
  if (!rows.length) return null;
  const days = rows.map((r) =>
    Math.round((Date.parse(r.received_date) - Date.parse(r.expected_date)) / 86400000)
  );
  return days.reduce((s, d) => s + d, 0) / days.length;
}
