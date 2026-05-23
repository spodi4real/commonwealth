import { db } from '../db.js';
import {
  currentMonth, daysInMonth, daysElapsedInMonth, monthBounds, todayISO,
} from './dates.js';
import { getSetting, SETTING_MONTHLY_INCOME_USD_CENTS } from './settings.js';
import { listGoalsEnriched } from './goals.js';
import { listBudgetsWithSpend } from './budgets.js';
import { getCurrentRate } from './rates.js';
import { getTodaysPrinciple } from './principles.js';
import { getDataMaturity } from './maturity.js';

export function getDashboard() {
  const month = currentMonth();
  const totalDays = daysInMonth(month);
  const elapsed = Math.max(daysElapsedInMonth(month), 1);
  const { start, endExclusive } = monthBounds(month);

  // Spending this month (all users, all non-deleted txns)
  const spent = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total
       FROM transactions
       WHERE created_at >= ? AND created_at < ? AND deleted_at IS NULL`
    )
    .get(start, endExclusive).total;

  const income = Number(getSetting(SETTING_MONTHLY_INCOME_USD_CENTS, 0));
  const net = income - spent;
  const savings_rate = income > 0 ? net / income : 0;
  const avg_daily_spend = spent / elapsed;
  const projected_month_spend = avg_daily_spend * totalDays;

  // Total wealth = all goal contributions to date
  const total_wealth = db
    .prepare('SELECT COALESCE(SUM(amount_usd_cents), 0) AS total FROM goal_contributions')
    .get().total;

  // Months of runway based on 90-day spend velocity (more stable than a
  // single month). If we have less than 30 days of data, fall back to
  // this-month's spend as a single data point.
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19);
  const last90 = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total
       FROM transactions
       WHERE created_at >= ? AND deleted_at IS NULL`
    )
    .get(since90).total;
  const avg_monthly_spend = last90 > 0
    ? last90 / 3
    : (spent > 0 ? spent : null);
  const months_of_runway = avg_monthly_spend && avg_monthly_spend > 0
    ? total_wealth / avg_monthly_spend
    : null;

  // Pending approvals queue size
  const pending_approvals_count = db
    .prepare("SELECT COUNT(*) AS c FROM mom_approval_requests WHERE status = 'pending'")
    .get().c;

  // "Saved by friction" this month
  const saved_by_friction_cents = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total
       FROM pending_desires
       WHERE kept = 0 AND resolved_at IS NOT NULL AND resolved_at >= ?`
    )
    .get(start).total;

  // "Days using Commonwealth" — from earliest user row.
  const userMin = db.prepare('SELECT MIN(created_at) AS first FROM users').get();
  const days_using = userMin?.first
    ? Math.floor((Date.now() - new Date(userMin.first.replace(' ', 'T') + 'Z').getTime()) / 86400000)
    : 0;

  return {
    today: todayISO(),
    month,
    days_in_month: totalDays,
    days_elapsed: elapsed,
    income_usd_cents: income,
    spent_usd_cents: spent,
    net_usd_cents: net,
    savings_rate,
    avg_daily_spend_cents: Math.round(avg_daily_spend),
    projected_month_spend_cents: Math.round(projected_month_spend),
    total_wealth_cents: total_wealth,
    months_of_runway,
    days_using,
    pending_approvals_count,
    saved_by_friction_this_month_cents: saved_by_friction_cents,
    rate: getCurrentRate(),
    goals: listGoalsEnriched(),
    budgets: listBudgetsWithSpend(month),
    principle: getTodaysPrinciple(),
    maturity: getDataMaturity(),
  };
}
