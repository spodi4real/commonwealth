// Mirror of server/src/lib/categories.js. Keep these two files in sync.

export const SPENDING_CATEGORIES = [
  'Food',
  'Transport',
  'Household',
  'Personal',
  'Unexpected',
  'Other',
];

export const SAVINGS_CATEGORIES = [
  'Savings',
  'Australia Fund',
  'Emergency Fund',
];

export const MOM_CATEGORIES = ['Food', 'Household', 'Personal', 'Transport', 'Other'];

export const MOM_BUDGET_LABEL = "Mom's Spending";

export const OWNER_BUDGET_CATEGORIES = [...SPENDING_CATEGORIES, MOM_BUDGET_LABEL];

export const TX_TYPES = [
  { key: 'need',       label: 'Need',       description: 'Necessary expense' },
  { key: 'want',       label: 'Want',       description: 'Optional purchase' },
  { key: 'investment', label: 'Investment', description: 'Builds future value' },
];
