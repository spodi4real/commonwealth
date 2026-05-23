import { Router } from 'express';
import { db } from '../db.js';
import {
  requireAuth, requireRole, requirePinChanged,
} from '../middleware/auth.js';
import { listBudgetsWithSpend } from '../lib/budgets.js';
import { currentMonth, daysInMonth, daysElapsedInMonth } from '../lib/dates.js';
import { OWNER_BUDGET_CATEGORIES } from '../lib/categories.js';

const router = Router();

const MONTH_RE = /^\d{4}-\d{2}$/;

router.get('/', requireAuth, requireRole('owner'), (req, res) => {
  const month = req.query.month && MONTH_RE.test(req.query.month) ? req.query.month : currentMonth();
  const rows = listBudgetsWithSpend(month);

  // Ensure every canonical category has a row, even if no DB record yet.
  const existing = new Map(rows.map((r) => [r.category, r]));
  const full = OWNER_BUDGET_CATEGORIES.map((cat) => existing.get(cat) ?? {
    category: cat,
    monthly_limit_usd_cents: 0,
    effective_month: month,
    spent_usd_cents: 0,
  });

  res.json({
    month,
    days_in_month: daysInMonth(month),
    days_elapsed: daysElapsedInMonth(month),
    budgets: full,
  });
});

// PUT { category, month, monthly_limit_usd_cents } — upsert by (category, month).
router.put('/', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const { category, month, monthly_limit_usd_cents } = req.body ?? {};

  if (!OWNER_BUDGET_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'unknown category' });
  }
  if (!MONTH_RE.test(month || '')) {
    return res.status(400).json({ error: 'month must be YYYY-MM' });
  }
  const cents = Math.round(Number(monthly_limit_usd_cents));
  if (!Number.isFinite(cents) || cents < 0) {
    return res.status(400).json({ error: 'monthly_limit_usd_cents must be a non-negative integer' });
  }

  const existing = db
    .prepare('SELECT * FROM budgets WHERE category = ? AND effective_month = ?')
    .get(category, month);

  if (existing) {
    db.prepare(
      'UPDATE budgets SET monthly_limit_usd_cents = ? WHERE id = ?'
    ).run(cents, existing.id);
    db.prepare(
      `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
       VALUES (?, 'update', 'budgets', ?, ?)`
    ).run(
      req.user.id,
      JSON.stringify(existing),
      JSON.stringify({ ...existing, monthly_limit_usd_cents: cents })
    );
  } else {
    const r = db
      .prepare(
        'INSERT INTO budgets (category, monthly_limit_usd_cents, effective_month) VALUES (?, ?, ?)'
      )
      .run(category, cents, month);
    db.prepare(
      `INSERT INTO audit_log (user_id, action, entity, after_json)
       VALUES (?, 'create', 'budgets', ?)`
    ).run(req.user.id, JSON.stringify({
      id: r.lastInsertRowid, category, monthly_limit_usd_cents: cents, effective_month: month,
    }));
  }

  res.json({ ok: true });
});

export default router;
