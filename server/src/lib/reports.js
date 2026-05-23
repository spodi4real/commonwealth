import { db } from '../db.js';
import {
  currentMonth, monthBounds, daysInMonth, ymd,
} from './dates.js';
import { getSetting, SETTING_MONTHLY_INCOME_USD_CENTS } from './settings.js';
import { getDataMaturity } from './maturity.js';
import { momUserId } from './budgets.js';

// All-in-one report builder. Returns null sections for insights that are
// still locked by data maturity — the client renders a "unlocks at N days"
// card in their place so the user can see what they're building toward.

export function getReports({ month }) {
  const maturity = getDataMaturity();
  const { start, endExclusive } = monthBounds(month);
  const momId = momUserId();

  const txns = db
    .prepare(
      `SELECT t.id, t.user_id, u.name AS user_name, t.amount_usd_cents,
              t.category, t.note, t.type, t.created_at
       FROM transactions t JOIN users u ON u.id = t.user_id
       WHERE t.created_at >= ? AND t.created_at < ? AND t.deleted_at IS NULL`
    )
    .all(start, endExclusive);

  const income = Number(getSetting(SETTING_MONTHLY_INCOME_USD_CENTS, 0));
  const allocated = txns.reduce((s, t) => s + t.amount_usd_cents, 0);
  const saved = income - allocated;
  const savings_rate = income > 0 ? saved / income : 0;
  const mom_spend = txns.filter((t) => t.user_id === momId).reduce((s, t) => s + t.amount_usd_cents, 0);

  // Category breakdown
  const by_category_map = {};
  for (const t of txns) {
    by_category_map[t.category] = (by_category_map[t.category] ?? 0) + t.amount_usd_cents;
  }
  const by_category = Object.entries(by_category_map)
    .map(([category, amount_usd_cents]) => ({ category, amount_usd_cents }))
    .sort((a, b) => b.amount_usd_cents - a.amount_usd_cents);

  // Top 5 single allocations
  const top5 = [...txns]
    .sort((a, b) => b.amount_usd_cents - a.amount_usd_cents)
    .slice(0, 5);

  // "Saved by friction"
  const saved_friction_lifetime = db
    .prepare("SELECT COALESCE(SUM(amount_usd_cents), 0) AS t FROM pending_desires WHERE kept = 0")
    .get().t;
  const saved_friction_month = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd_cents), 0) AS t
       FROM pending_desires
       WHERE kept = 0 AND resolved_at IS NOT NULL AND resolved_at >= ?`
    )
    .get(start).t;

  // Trend — unlocked at 60 days. Returns array of { date, total, rolling7 }
  let trend = null;
  if (maturity.unlocks.trends) {
    trend = buildTrend({ days: 60 });
  } else if (maturity.unlocks.monthlySummary) {
    // Even at 30+ days give them a small in-month trend.
    trend = buildTrend({ days: 30 });
  }

  // Goal velocity — unlocked at 90 days
  let goal_velocity = null;
  if (maturity.unlocks.momentum) {
    goal_velocity = buildGoalVelocity();
  }

  // Best / worst month — unlocked at 180 days
  let monthly_history = null;
  if (maturity.unlocks.seasonal) {
    monthly_history = buildMonthlyHistory();
  }

  return {
    month,
    maturity,
    summary: {
      income_usd_cents: income,
      allocated_usd_cents: allocated,
      saved_usd_cents: saved,
      savings_rate,
      mom_spend_usd_cents: mom_spend,
      transaction_count: txns.length,
    },
    by_category,
    top5,
    saved_friction_lifetime_usd_cents: saved_friction_lifetime,
    saved_friction_month_usd_cents: saved_friction_month,
    trend,
    goal_velocity,
    monthly_history,
  };
}

function buildTrend({ days }) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().replace('T', ' ').slice(0, 19);
  const rows = db
    .prepare(
      `SELECT date(created_at) AS d, SUM(amount_usd_cents) AS total
       FROM transactions
       WHERE created_at >= ? AND deleted_at IS NULL
       GROUP BY date(created_at) ORDER BY d`
    )
    .all(sinceStr);

  // Fill missing days with 0 so the chart is continuous.
  const byDate = new Map(rows.map((r) => [r.d, r.total]));
  const out = [];
  for (let i = days; i >= 0; i--) {
    const d = ymd(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
    out.push({ date: d, total: byDate.get(d) ?? 0 });
  }
  // Rolling 7-day average
  for (let i = 0; i < out.length; i++) {
    const win = out.slice(Math.max(0, i - 6), i + 1);
    out[i].rolling7 = Math.round(win.reduce((s, x) => s + x.total, 0) / win.length);
  }
  return out;
}

function buildGoalVelocity() {
  const goals = db.prepare('SELECT id, name, target_usd_cents FROM goals').all();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  return goals.map((g) => {
    const rows = db
      .prepare(
        `SELECT date(contributed_at) AS d, SUM(amount_usd_cents) AS total
         FROM goal_contributions
         WHERE goal_id = ? AND contributed_at >= ?
         GROUP BY date(contributed_at) ORDER BY d`
      )
      .all(g.id, since);
    const total_90d = rows.reduce((s, r) => s + r.total, 0);
    return {
      goal_id: g.id,
      name: g.name,
      target_usd_cents: g.target_usd_cents,
      total_90d_usd_cents: total_90d,
      per_day_usd_cents: Math.round(total_90d / 90),
      contributions: rows,
    };
  });
}

function buildMonthlyHistory() {
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month,
              SUM(amount_usd_cents) AS allocated,
              COUNT(*) AS tx_count
       FROM transactions
       WHERE deleted_at IS NULL
       GROUP BY month
       ORDER BY month DESC
       LIMIT 24`
    )
    .all();
  return rows.reverse();
}
