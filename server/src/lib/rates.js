import { db } from '../db.js';

// Look up the rate active on a given YYYY-MM-DD date.
// "Active" = largest effective_date <= the given date.
// Used by transactions (Phase 3+) to display historical txns in IQD using the
// rate that was true on the day of the transaction — never re-priced.
export function getRateOnOrBefore(date) {
  return db
    .prepare(
      `SELECT id, rate_iqd_per_usd, effective_date
       FROM exchange_rates
       WHERE effective_date <= ?
       ORDER BY effective_date DESC
       LIMIT 1`
    )
    .get(date) ?? null;
}

export function getCurrentRate() {
  const today = new Date().toISOString().slice(0, 10);
  return getRateOnOrBefore(today);
}

export function listRates({ from, to } = {}) {
  let sql = `SELECT id, rate_iqd_per_usd, effective_date, created_at
             FROM exchange_rates`;
  const params = [];
  const where = [];
  if (from) { where.push('effective_date >= ?'); params.push(from); }
  if (to)   { where.push('effective_date <= ?'); params.push(to); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY effective_date DESC';
  return db.prepare(sql).all(...params);
}
