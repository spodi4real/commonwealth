import { db } from '../db.js';
import { currentMonth, daysInMonth, daysElapsedInMonth } from './dates.js';
import { getCurrentRate } from './rates.js';
import {
  getSetting,
  SETTING_MOM_AUTO_APPROVE_USD,
  SETTING_MOM_HARD_LIMIT_USD,
} from './settings.js';
import { getBudget, membersSpend } from './budgets.js';
import { MOM_BUDGET_LABEL } from './categories.js';

// Evaluate a "can I spend this?" request from Mom.
// Returns { verdict, reason, ... } — does NOT create a transaction. Logging
// the actual spend is a separate, deliberate act ("I spent this").
//
// Rules:
//   - No exchange rate set → verdict = 'red' (we can't even price it).
//   - amount_usd > hard_limit  → red.
//   - this would push her over the monthly Mom budget → red.
//   - amount_usd > auto_approve OR would exceed 80% of budget → amber.
//   - otherwise → green.
export function evaluateCanISpend({ amount_iqd, category }) {
  const rate = getCurrentRate();
  if (!rate) {
    return { verdict: 'red', reason: 'No exchange rate set. Ask Owner to set one first.', code: 'no_rate' };
  }
  if (!Number.isFinite(amount_iqd) || amount_iqd <= 0) {
    return { verdict: 'red', reason: 'Enter a positive amount.', code: 'bad_amount' };
  }

  const amount_usd_cents = Math.round((amount_iqd / rate.rate_iqd_per_usd) * 100);
  const amount_usd = amount_usd_cents / 100;

  const hardLimit  = Number(getSetting(SETTING_MOM_HARD_LIMIT_USD,  25));
  const autoApprove = Number(getSetting(SETTING_MOM_AUTO_APPROVE_USD, 5));

  if (amount_usd > hardLimit) {
    return {
      verdict: 'red',
      reason: `That's over the hard limit (\$${hardLimit}). Owner must log it themselves.`,
      code: 'hard_limit',
      amount_usd_cents,
    };
  }

  const month = currentMonth();
  const spent = membersSpend(month);
  const momBudget = getBudget(MOM_BUDGET_LABEL, month);

  if (momBudget) {
    const wouldBe = spent + amount_usd_cents;
    if (wouldBe > momBudget.monthly_limit_usd_cents) {
      return {
        verdict: 'red',
        reason: 'That would push you over this month\'s spending plan.',
        code: 'over_budget',
        amount_usd_cents,
      };
    }
    const pct = wouldBe / momBudget.monthly_limit_usd_cents;
    if (pct > 0.8) {
      return {
        verdict: 'amber',
        reason: `You'd be at ${Math.round(pct * 100)}% of this month's plan. Owner should weigh in.`,
        code: 'near_budget',
        amount_usd_cents,
      };
    }
  }

  if (amount_usd > autoApprove) {
    return {
      verdict: 'amber',
      reason: `That's above the auto-approve floor (\$${autoApprove}). Sending to Owner.`,
      code: 'above_auto',
      amount_usd_cents,
    };
  }

  return { verdict: 'green', reason: 'Within plan. Go ahead.', code: 'ok', amount_usd_cents };
}

export function createApprovalRequest({ amount_iqd, category }) {
  const r = db
    .prepare(
      `INSERT INTO mom_approval_requests (amount_iqd, category, status)
       VALUES (?, ?, 'pending')`
    )
    .run(Math.round(amount_iqd), category);
  return db
    .prepare('SELECT * FROM mom_approval_requests WHERE id = ?')
    .get(r.lastInsertRowid);
}

// Today's allowance, shared by every non-owner member.
//   = (monthly family budget − month-to-date combined spend) / days left
export function getMomAllowance() {
  const month = currentMonth();
  const rate = getCurrentRate();
  const budget = getBudget(MOM_BUDGET_LABEL, month);

  if (!budget) {
    return { status: 'no_budget', allowance_iqd: null, daily_target_iqd: null };
  }
  if (!rate) {
    return { status: 'no_rate', allowance_iqd: null, daily_target_iqd: null };
  }

  const spent = membersSpend(month);
  const remainingCents = budget.monthly_limit_usd_cents - spent;
  const totalDays = daysInMonth(month);
  const elapsed = Math.max(daysElapsedInMonth(month), 1);
  const daysLeftIncl = Math.max(totalDays - elapsed + 1, 1);

  const allowanceCents = Math.max(remainingCents / daysLeftIncl, 0);
  const dailyTargetCents = budget.monthly_limit_usd_cents / totalDays;

  const allowance_iqd = Math.round((allowanceCents / 100) * rate.rate_iqd_per_usd);
  const daily_target_iqd = Math.round((dailyTargetCents / 100) * rate.rate_iqd_per_usd);

  let status = 'green';
  if (allowanceCents <= 0) status = 'red';
  else if (allowanceCents < dailyTargetCents * 0.5) status = 'amber';

  return {
    status,
    allowance_iqd,
    daily_target_iqd,
    spent_usd_cents: spent,
    budget_usd_cents: budget.monthly_limit_usd_cents,
    remaining_usd_cents: Math.max(remainingCents, 0),
    days_left: daysLeftIncl,
  };
}
