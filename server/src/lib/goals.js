import { db } from '../db.js';

// Returns goals enriched with contribution totals and an optional projection.
//
// Projection: requires at least 7 contributions OR 30 days of data since the
// goal was created. If the goal has no momentum, the projection is null
// and the UI shows "Projection unlocks at 30 days" — a feature, not a bug.

export function listGoalsEnriched() {
  const goals = db
    .prepare('SELECT id, name, target_usd_cents, created_at FROM goals ORDER BY id')
    .all();

  return goals.map((g) => {
    const totals = db
      .prepare(
        `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total,
                COUNT(*) AS contribution_count,
                MIN(contributed_at) AS first_contribution
         FROM goal_contributions
         WHERE goal_id = ?`
      )
      .get(g.id);

    const contributed = totals.total;
    const remaining = Math.max(g.target_usd_cents - contributed, 0);

    // Velocity = sum of contributions in last 30 days / 30
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const recent = db
      .prepare(
        `SELECT COALESCE(SUM(amount_usd_cents), 0) AS total
         FROM goal_contributions
         WHERE goal_id = ? AND contributed_at >= ?`
      )
      .get(g.id, since);

    let projected_completion_date = null;
    let velocity_per_day_cents = 0;
    let projection_status = 'locked';

    const firstContributionDate = totals.first_contribution
      ? new Date(totals.first_contribution.replace(' ', 'T') + 'Z')
      : null;
    const daysSinceFirst = firstContributionDate
      ? Math.floor((Date.now() - firstContributionDate.getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    if (totals.contribution_count >= 3 && daysSinceFirst >= 14 && recent.total > 0 && remaining > 0) {
      velocity_per_day_cents = recent.total / 30;
      const daysToComplete = remaining / velocity_per_day_cents;
      const completionMs = Date.now() + daysToComplete * 24 * 60 * 60 * 1000;
      projected_completion_date = new Date(completionMs).toISOString().slice(0, 10);
      projection_status = 'ok';
    } else if (remaining === 0) {
      projection_status = 'complete';
    } else if (totals.contribution_count === 0) {
      projection_status = 'no_contributions';
    } else {
      projection_status = 'too_early';
    }

    return {
      ...g,
      contributed_usd_cents: contributed,
      remaining_usd_cents: remaining,
      contribution_count: totals.contribution_count,
      velocity_per_day_cents,
      projected_completion_date,
      projection_status,
    };
  });
}

export function listContributions(goalId, limit = 100) {
  return db
    .prepare(
      `SELECT id, goal_id, amount_usd_cents, contributed_at
       FROM goal_contributions
       WHERE goal_id = ?
       ORDER BY contributed_at DESC, id DESC
       LIMIT ?`
    )
    .all(goalId, limit);
}
