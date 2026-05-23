// Canonical category vocabulary. Single source of truth — the client mirrors
// this in client/src/lib/categories.js. If you change one, change both.

export const SPENDING_CATEGORIES = [
  'Food',
  'Transport',
  'Household',
  'Personal',
  'Unexpected',
  'Other',
];

// Locked categories cannot be set on a regular transaction. They only ever
// receive value through goal contributions or the monthly savings lock
// (Phase 6). Listing them in a transaction body is rejected.
export const SAVINGS_CATEGORIES = [
  'Savings',
  'Australia Fund',
  'Emergency Fund',
];

// Categories Mom is allowed to select when logging her spending.
export const MOM_CATEGORIES = ['Food', 'Household', 'Personal', 'Transport', 'Other'];

// Synthetic label used in Owner's budget table to track Mom's total spending
// regardless of category. Not a real transaction category — burn rate is
// computed by summing all of Mom's transactions for the month.
export const MOM_BUDGET_LABEL = "Mom's Spending";

export const OWNER_BUDGET_CATEGORIES = [...SPENDING_CATEGORIES, MOM_BUDGET_LABEL];

export function isSpendingCategory(c)  { return SPENDING_CATEGORIES.includes(c); }
export function isSavingsCategory(c)   { return SAVINGS_CATEGORIES.includes(c); }
export function isLockedCategory(c)    { return SAVINGS_CATEGORIES.includes(c); }
export function isMomCategory(c)       { return MOM_CATEGORIES.includes(c); }
