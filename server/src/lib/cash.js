import { db } from '../db.js';
import { getCurrentRate } from './rates.js';

export function listCashAccounts({ includeArchived = false } = {}) {
  const sql = includeArchived
    ? 'SELECT * FROM cash_accounts ORDER BY archived_at IS NOT NULL, id'
    : 'SELECT * FROM cash_accounts WHERE archived_at IS NULL ORDER BY id';
  return db.prepare(sql).all();
}

export function totalCashUsdCents() {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(balance_usd_cents), 0) AS total
       FROM cash_accounts WHERE archived_at IS NULL`
    )
    .get();
  return row.total;
}

// Convenience: when an IQD-native account's balance_iqd changes, recompute
// balance_usd_cents using the current rate so totals stay coherent.
export function syncIqdAccountUsd(id) {
  const acc = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(id);
  if (!acc || acc.type !== 'cash_iqd' || acc.balance_iqd == null) return;
  const rate = getCurrentRate();
  if (!rate) return;
  const cents = Math.round((acc.balance_iqd / rate.rate_iqd_per_usd) * 100);
  db.prepare('UPDATE cash_accounts SET balance_usd_cents = ? WHERE id = ?').run(cents, id);
}
