import { Router } from 'express';
import { db } from '../db.js';
import {
  requireAuth, requireRole, requirePinChanged,
} from '../middleware/auth.js';
import {
  getSetting, setSetting,
  SETTING_SETUP_COMPLETE, SETTING_OPENING_DATE,
} from '../lib/settings.js';
import { todayISO } from '../lib/dates.js';
import { getCurrentRate } from '../lib/rates.js';

const router = Router();

const VALID_CASH_TYPES = ['cash_iqd','cash_usd','bank','other'];

// Quick status check the client uses to know whether to send Owner to the
// first-run wizard.
router.get('/status', requireAuth, (req, res) => {
  res.json({
    setup_complete: !!getSetting(SETTING_SETUP_COMPLETE, false),
    opening_date:   getSetting(SETTING_OPENING_DATE, null),
  });
});

// One-shot transaction that seeds the user's reality. Designed to be called
// from the wizard so the user lands on a populated dashboard.
//
// Body shape:
// {
//   rate_iqd_per_usd: 1500,
//   cash_accounts: [ { name, type, balance_usd?, balance_iqd? }, ... ],
//   opening_savings: [ { goal_id, amount_usd }, ... ],
//   primary_income: { name, type, expected_amount_usd, expected_day_of_month }
// }
router.post('/complete', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const { rate_iqd_per_usd, cash_accounts = [], opening_savings = [], primary_income } = req.body ?? {};

  const today = todayISO();
  const errors = [];

  const tx = db.transaction(() => {
    // 1. Set rate if provided (and none exists for today).
    if (Number.isFinite(rate_iqd_per_usd) && rate_iqd_per_usd > 0) {
      db.prepare(
        `INSERT INTO exchange_rates (rate_iqd_per_usd, effective_date)
         VALUES (?, ?)
         ON CONFLICT(effective_date) DO UPDATE SET rate_iqd_per_usd = excluded.rate_iqd_per_usd`
      ).run(rate_iqd_per_usd, today);
    }

    // 2. Cash accounts.
    const rate = getCurrentRate();
    for (const acc of cash_accounts) {
      if (!acc?.name || !VALID_CASH_TYPES.includes(acc.type)) {
        errors.push(`bad cash account: ${JSON.stringify(acc)}`); continue;
      }
      let cents = 0;
      let iqd = null;
      if (Number.isFinite(acc.balance_usd))      cents = Math.round(acc.balance_usd * 100);
      else if (Number.isFinite(acc.balance_usd_cents)) cents = Math.round(acc.balance_usd_cents);
      else if (acc.type === 'cash_iqd' && Number.isFinite(acc.balance_iqd) && rate) {
        iqd = Math.round(acc.balance_iqd);
        cents = Math.round((iqd / rate.rate_iqd_per_usd) * 100);
      }
      if (cents < 0) cents = 0;
      db.prepare(
        `INSERT INTO cash_accounts (name, type, balance_usd_cents, balance_iqd, notes)
         VALUES (?, ?, ?, ?, ?)`
      ).run(acc.name.trim(), acc.type, cents, iqd, acc.notes?.toString().slice(0, 500) ?? null);
    }

    // 3. Opening savings — credited as goal contributions with a special note.
    for (const os of opening_savings) {
      const gid = Number(os.goal_id);
      const usd = Number.isFinite(os.amount_usd_cents)
        ? Math.round(os.amount_usd_cents)
        : Number.isFinite(os.amount_usd) ? Math.round(os.amount_usd * 100) : 0;
      if (!gid || usd <= 0) continue;
      const goalExists = db.prepare('SELECT id FROM goals WHERE id = ?').get(gid);
      if (!goalExists) { errors.push(`unknown goal_id ${gid}`); continue; }
      db.prepare(
        `INSERT INTO goal_contributions (goal_id, amount_usd_cents, contributed_at)
         VALUES (?, ?, ?)`
      ).run(gid, usd, `${today} 00:00:00`);
    }

    // 4. Primary income source.
    if (primary_income?.name && primary_income?.type) {
      const cents = Number.isFinite(primary_income.expected_amount_usd)
        ? Math.round(primary_income.expected_amount_usd * 100)
        : Number.isFinite(primary_income.expected_amount_usd_cents)
          ? Math.round(primary_income.expected_amount_usd_cents) : 0;
      const day = primary_income.expected_day_of_month != null
        ? Number(primary_income.expected_day_of_month) : null;
      db.prepare(
        `INSERT INTO income_sources (name, type, expected_amount_usd_cents,
           is_recurring, expected_day_of_month, is_active)
         VALUES (?, ?, ?, 1, ?, 1)`
      ).run(primary_income.name.trim(), primary_income.type, cents, day);
    }

    setSetting(SETTING_SETUP_COMPLETE, true);
    setSetting(SETTING_OPENING_DATE, today);
  });

  try { tx(); }
  catch (e) {
    return res.status(500).json({ error: 'setup failed', detail: String(e) });
  }

  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, after_json)
     VALUES (?, 'complete', 'setup', ?)`
  ).run(req.user.id, JSON.stringify({ rate_iqd_per_usd, cash_accounts, opening_savings, primary_income, errors }));

  res.json({ ok: true, errors, opening_date: getSetting(SETTING_OPENING_DATE) });
});

// Allow re-running parts later (e.g. "Adjust Current Position" from Settings).
router.post('/reset', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  setSetting(SETTING_SETUP_COMPLETE, false);
  res.json({ ok: true });
});

export default router;
