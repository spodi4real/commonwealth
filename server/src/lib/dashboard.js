import { db } from '../db.js';
import {
  currentMonth, daysInMonth, daysElapsedInMonth, monthBounds, todayISO,
} from './dates.js';
import { listGoalsEnriched } from './goals.js';
import { listBudgetsWithSpend } from './budgets.js';
import { getCurrentRate } from './rates.js';
import { getTodaysPrinciple } from './principles.js';
import { getDataMaturity } from './maturity.js';
import {
  effectiveMonthlyIncome, actualThisMonth, expectedThisMonth,
  reliabilityScore, averageDelayDays, upcomingForecast,
} from './income.js';
import { totalCashUsdCents } from './cash.js';

export function getDashboard() {
  const month = currentMonth();
  const totalDays = daysInMonth(month);
  const elapsed = Math.max(daysElapsedInMonth(month), 1);
  const { start, endExclusive } = monthBounds(month);

  const spent = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total
       FROM transactions
       WHERE created_at >= ? AND created_at < ? AND deleted_at IS NULL`
    )
    .get(start, endExclusive).total;

  // Income: actual received this month (real, not assumed)
  const actual_income_this_month = actualThisMonth(month);
  const expected_income_this_month = expectedThisMonth(month);
  const effective_income = effectiveMonthlyIncome();

  // Net position uses actual income so the dashboard shows reality, not the plan.
  const net = actual_income_this_month - spent;
  const savings_rate = actual_income_this_month > 0 ? net / actual_income_this_month : 0;

  const avg_daily_spend = spent / elapsed;
  const projected_month_spend = avg_daily_spend * totalDays;

  // Total wealth = cash on hand + capital deployed into goals
  const total_goal_capital = db
    .prepare('SELECT COALESCE(SUM(amount_usd_cents), 0) AS total FROM goal_contributions')
    .get().total;
  const total_cash = totalCashUsdCents();
  const total_wealth = total_cash + total_goal_capital;

  // Runway: cash on hand divided by avg monthly spend (last 90 days).
  // We use cash (not goal balances) — those are deployed capital, not runway.
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19);
  const last90 = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total
       FROM transactions
       WHERE created_at >= ? AND deleted_at IS NULL`
    )
    .get(since90).total;
  const avg_monthly_spend = last90 > 0 ? last90 / 3 : (spent > 0 ? spent : null);
  const months_of_runway = avg_monthly_spend && avg_monthly_spend > 0
    ? total_cash / avg_monthly_spend
    : null;

  const pending_approvals_count = db
    .prepare("SELECT COUNT(*) AS c FROM mom_approval_requests WHERE status = 'pending'")
    .get().c;

  const saved_by_friction_cents = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total
       FROM pending_desires
       WHERE kept = 0 AND resolved_at IS NOT NULL AND resolved_at >= ?`
    )
    .get(start).total;

  const userMin = db.prepare('SELECT MIN(created_at) AS first FROM users').get();
  const days_using = userMin?.first
    ? Math.floor((Date.now() - new Date(userMin.first.replace(' ', 'T') + 'Z').getTime()) / 86400000)
    : 0;

  // Income forecast — surface anything overdue so the dashboard can render
  // an amber banner without a second round-trip.
  const forecast = upcomingForecast({ horizonMonths: 1 });
  const overdue = forecast.filter((f) => f.status === 'overdue');

  return {
    today: todayISO(),
    month,
    days_in_month: totalDays,
    days_elapsed: elapsed,

    // Income (the new shape)
    actual_income_this_month_usd_cents:   actual_income_this_month,
    expected_income_this_month_usd_cents: expected_income_this_month,
    effective_monthly_income_usd_cents:   effective_income,
    income_reliability_score:             reliabilityScore(),
    avg_income_delay_days:                averageDelayDays(),
    overdue_income:                       overdue,

    // Position
    total_cash_usd_cents:    total_cash,
    total_goal_capital_usd_cents: total_goal_capital,
    total_wealth_cents:      total_wealth,

    // Flow
    spent_usd_cents:         spent,
    net_usd_cents:           net,
    savings_rate,
    avg_daily_spend_cents:   Math.round(avg_daily_spend),
    projected_month_spend_cents: Math.round(projected_month_spend),
    months_of_runway,
    days_using,
    pending_approvals_count,
    saved_by_friction_this_month_cents: saved_by_friction_cents,

    rate:      getCurrentRate(),
    goals:     listGoalsEnriched(),
    budgets:   listBudgetsWithSpend(month),
    principle: getTodaysPrinciple(),
    maturity:  getDataMaturity(),
  };
}
