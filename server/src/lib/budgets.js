import { db } from '../db.js';
import { monthBounds } from './dates.js';
import { MOM_BUDGET_LABEL } from './categories.js';

export function getBudget(category, month) {
  return db
    .prepare(
      `SELECT id, category, monthly_limit_usd_cents, effective_month
       FROM budgets
       WHERE category = ? AND effective_month = ?`
    )
    .get(category, month) ?? null;
}

export function listBudgets(month) {
  return db
    .prepare(
      `SELECT id, category, monthly_limit_usd_cents, effective_month
       FROM budgets WHERE effective_month = ?
       ORDER BY id`
    )
    .all(month);
}

// Sum of non-deleted transactions for a category in a month, in USD cents.
export function categorySpend(category, month) {
  const { start, endExclusive } = monthBounds(month);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total
       FROM transactions
       WHERE category = ?
         AND created_at >= ? AND created_at < ?
         AND deleted_at IS NULL`
    )
    .get(category, start, endExclusive);
  return row.total;
}

// Sum of a single user's non-deleted transactions in a month.
export function userSpend(userId, month) {
  const { start, endExclusive } = monthBounds(month);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total
       FROM transactions
       WHERE user_id = ?
         AND created_at >= ? AND created_at < ?
         AND deleted_at IS NULL`
    )
    .get(userId, start, endExclusive);
  return row.total;
}

// Sum across every non-owner user — the synthetic "Family spending" budget
// is shared by Najwa + Majed (and any future members).
export function membersSpend(month) {
  const { start, endExclusive } = monthBounds(month);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(t.amount_usd_cents), 0) AS total
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE u.role != 'owner'
         AND t.created_at >= ? AND t.created_at < ?
         AND t.deleted_at IS NULL`
    )
    .get(start, endExclusive);
  return row.total;
}

export function memberUserIds() {
  return db.prepare("SELECT id FROM users WHERE role != 'owner' ORDER BY id").all().map((r) => r.id);
}

// Back-compat: kept for any old caller. Returns the first non-owner id.
export function momUserId() {
  const row = db.prepare("SELECT id FROM users WHERE role = 'mom' ORDER BY id LIMIT 1").get();
  return row?.id ?? null;
}

// For Owner's budget dashboard: returns each budget row with its spend.
// "Family spending" is summed by role, not by category.
export function listBudgetsWithSpend(month) {
  const budgets = listBudgets(month);
  return budgets.map((b) => {
    const spent_usd_cents = b.category === MOM_BUDGET_LABEL
      ? membersSpend(month)
      : categorySpend(b.category, month);
    return { ...b, spent_usd_cents };
  });
}
