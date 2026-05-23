import { db } from '../db.js';
import { monthBounds } from './dates.js';
import { MOM_BUDGET_LABEL } from './categories.js';

// Returns { category, monthly_limit_usd_cents } or null.
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

// Sum of a user's non-deleted transactions in a month — used to compute the
// synthetic "Mom's Spending" burn rate regardless of category.
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

export function momUserId() {
  const row = db.prepare("SELECT id FROM users WHERE role = 'mom'").get();
  return row?.id ?? null;
}

// For Owner's budget dashboard: returns each budget row with its spend.
// For "Mom's Spending" the spend is sum-by-user, not sum-by-category.
export function listBudgetsWithSpend(month) {
  const budgets = listBudgets(month);
  const momId = momUserId();
  return budgets.map((b) => {
    const spent_usd_cents = b.category === MOM_BUDGET_LABEL
      ? (momId ? userSpend(momId, month) : 0)
      : categorySpend(b.category, month);
    return { ...b, spent_usd_cents };
  });
}
