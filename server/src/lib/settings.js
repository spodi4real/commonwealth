import { db } from '../db.js';

// Tiny key/value store for app-level config (monthly income, friction
// thresholds, etc). All values stored as JSON strings so booleans and
// numbers round-trip cleanly.

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}

export function setSetting(key, value) {
  const v = JSON.stringify(value);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, v);
}

export function allSettings() {
  const rows = db.prepare('SELECT key, value, updated_at FROM settings').all();
  const out = {};
  for (const r of rows) {
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
  }
  return out;
}

// Canonical keys.
export const SETTING_MONTHLY_INCOME_USD_CENTS = 'monthly_income_usd_cents';
export const SETTING_FRICTION_THRESHOLD_USD   = 'friction_threshold_usd';
export const SETTING_MOM_AUTO_APPROVE_USD     = 'mom_auto_approve_usd';
export const SETTING_MOM_HARD_LIMIT_USD       = 'mom_hard_limit_usd';
export const SETTING_SETUP_COMPLETE           = 'setup_complete';
export const SETTING_OPENING_DATE             = 'opening_date';  // when Current Position was first established
