import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.resolve(__dirname, '..', '..', 'db');
const DB_PATH = path.join(DB_DIR, 'commonwealth.sqlite');

fs.mkdirSync(DB_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  role            TEXT NOT NULL CHECK(role IN ('owner','mom')),
  pin_hash        TEXT NOT NULL,
  must_change_pin INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id               INTEGER PRIMARY KEY,
  rate_iqd_per_usd REAL NOT NULL,
  effective_date   TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  amount_usd_cents INTEGER NOT NULL,
  category         TEXT NOT NULL,
  note             TEXT,
  type             TEXT CHECK(type IN ('need','want','investment')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_user_created ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_category_created ON transactions(category, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_deleted ON transactions(deleted_at);

CREATE TABLE IF NOT EXISTS budgets (
  id                      INTEGER PRIMARY KEY,
  category                TEXT NOT NULL,
  monthly_limit_usd_cents INTEGER NOT NULL,
  effective_month         TEXT NOT NULL,  -- YYYY-MM
  UNIQUE(category, effective_month)
);

CREATE TABLE IF NOT EXISTS goals (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  target_usd_cents INTEGER NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id               INTEGER PRIMARY KEY,
  goal_id          INTEGER NOT NULL REFERENCES goals(id),
  amount_usd_cents INTEGER NOT NULL,
  contributed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_goal_contrib_goal ON goal_contributions(goal_id);

CREATE TABLE IF NOT EXISTS pending_desires (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  amount_usd_cents INTEGER NOT NULL,
  category         TEXT NOT NULL,
  note             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at      TEXT,
  kept             INTEGER       -- NULL until resolved, 1 if followed through, 0 if abandoned
);

CREATE TABLE IF NOT EXISTS mom_approval_requests (
  id          INTEGER PRIMARY KEY,
  amount_iqd  INTEGER NOT NULL,
  category    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
  owner_note  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS monthly_reviews (
  id         INTEGER PRIMARY KEY,
  month      TEXT NOT NULL UNIQUE,  -- YYYY-MM
  q1 TEXT, q2 TEXT, q3 TEXT, q4 TEXT, q5 TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wealth_principles (
  id     INTEGER PRIMARY KEY,
  text   TEXT NOT NULL UNIQUE,
  weight INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  before_json TEXT,
  after_json  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

db.exec(SCHEMA);

export default db;
