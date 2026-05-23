import { db } from '../db.js';

// Data maturity is computed from the oldest non-deleted transaction. A core
// product feature: by surfacing what unlocks at each milestone, we turn
// "the app feels empty" into "I'm building toward something."

const MILESTONES = [14, 30, 60, 90, 180, 365];

export function getDataMaturity() {
  const row = db
    .prepare(
      `SELECT MIN(created_at) AS first
       FROM transactions
       WHERE deleted_at IS NULL`
    )
    .get();

  const firstStr = row?.first;
  const days = firstStr
    ? Math.floor((Date.now() - new Date(firstStr.replace(' ', 'T') + 'Z').getTime()) / 86400000)
    : 0;

  const next = MILESTONES.find((m) => m > days) ?? null;
  const unlocks = {
    monthlySummary: days >= 30,
    trends:         days >= 60,
    momentum:       days >= 90,
    seasonal:       days >= 180,
    yearOverYear:   days >= 365,
  };

  return {
    days_since_first_transaction: days,
    next_milestone_days: next,
    days_to_next_milestone: next != null ? next - days : null,
    unlocks,
  };
}
