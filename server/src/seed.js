import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { currentMonth } from './lib/dates.js';
import { OWNER_BUDGET_CATEGORIES } from './lib/categories.js';
import {
  setSetting,
  SETTING_MONTHLY_INCOME_USD_CENTS,
  SETTING_FRICTION_THRESHOLD_USD,
  SETTING_MOM_AUTO_APPROVE_USD,
  SETTING_MOM_HARD_LIMIT_USD,
} from './lib/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRINCIPLES_PATH = path.resolve(__dirname, '..', '..', 'seeds', 'wealth_principles.json');

const DEFAULT_PIN = '0000';

function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) {
    console.log(`[seed] users already present (${count}) — skipping`);
    return;
  }
  const hash = bcrypt.hashSync(DEFAULT_PIN, 10);
  const insert = db.prepare(
    'INSERT INTO users (name, role, pin_hash, must_change_pin) VALUES (?, ?, ?, 1)'
  );
  insert.run('Owner', 'owner', hash);
  insert.run('Najwa', 'mom', hash);
  insert.run('Majed', 'mom', hash);
  console.log('[seed] inserted Owner, Najwa, Majed with PIN 0000 (must change on first login)');
}

function seedPrinciples() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM wealth_principles').get().c;
  if (count > 0) {
    console.log(`[seed] wealth_principles already present (${count}) — skipping`);
    return;
  }
  const raw = fs.readFileSync(PRINCIPLES_PATH, 'utf8');
  const list = JSON.parse(raw);
  const insert = db.prepare('INSERT INTO wealth_principles (text, weight) VALUES (?, 1)');
  const tx = db.transaction((items) => {
    for (const text of items) insert.run(text);
  });
  tx(list);
  console.log(`[seed] inserted ${list.length} wealth principles`);
}

// Defaults sized to the $1000/mo case from the spec. Owner can adjust any of
// these in the Budgets, Goals, and Settings pages.
const DEFAULT_BUDGETS_USD = {
  'Food': 250,
  'Transport': 50,
  'Household': 100,
  'Personal': 50,
  'Family spending': 80,
  'Unexpected': 50,
  'Other': 20,
};

const DEFAULT_GOALS = [
  { name: 'Emergency Fund',  target_usd: 1000 },
  { name: 'Australia Fund',  target_usd: 5000 },
];

function seedBudgets() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM budgets').get().c;
  if (count > 0) {
    console.log(`[seed] budgets already present (${count}) — skipping`);
    return;
  }
  const month = currentMonth();
  const insert = db.prepare(
    'INSERT INTO budgets (category, monthly_limit_usd_cents, effective_month) VALUES (?, ?, ?)'
  );
  const tx = db.transaction(() => {
    for (const cat of OWNER_BUDGET_CATEGORIES) {
      const usd = DEFAULT_BUDGETS_USD[cat] ?? 0;
      insert.run(cat, usd * 100, month);
    }
  });
  tx();
  console.log(`[seed] inserted default budgets for ${month}`);
}

function seedGoals() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM goals').get().c;
  if (count > 0) {
    console.log(`[seed] goals already present (${count}) — skipping`);
    return;
  }
  const insert = db.prepare('INSERT INTO goals (name, target_usd_cents) VALUES (?, ?)');
  for (const g of DEFAULT_GOALS) insert.run(g.name, g.target_usd * 100);
  console.log(`[seed] inserted ${DEFAULT_GOALS.length} goals`);
}

function seedSettings() {
  // Only set if missing — preserves user customizations across re-seeds.
  const row = db.prepare('SELECT key FROM settings WHERE key = ?').get(SETTING_MONTHLY_INCOME_USD_CENTS);
  if (row) {
    console.log('[seed] settings already present — skipping');
    return;
  }
  setSetting(SETTING_MONTHLY_INCOME_USD_CENTS, 100000); // $1000
  setSetting(SETTING_FRICTION_THRESHOLD_USD, 20);       // ≥$20 → justification modal
  setSetting(SETTING_MOM_AUTO_APPROVE_USD, 5);          // <$5 USD → GREEN auto-approve
  setSetting(SETTING_MOM_HARD_LIMIT_USD, 25);           // >$25 USD → RED, blocked
  console.log('[seed] inserted default settings');
}

seedUsers();
seedPrinciples();
seedBudgets();
seedGoals();
seedSettings();

console.log('[seed] done.');
