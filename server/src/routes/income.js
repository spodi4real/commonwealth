import { Router } from 'express';
import { db } from '../db.js';
import {
  requireAuth, requireRole, requirePinChanged,
} from '../middleware/auth.js';
import {
  listSources, listEntries, upcomingForecast, effectiveMonthlyIncome,
  actualThisMonth, expectedThisMonth, reliabilityScore, averageDelayDays,
} from '../lib/income.js';

const router = Router();

const VALID_SOURCE_TYPES = ['salary','bonus','freelance','gift','refund','other'];
const VALID_STATUSES = ['received','partial','pending','overdue','missed'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- sources ----

router.get('/sources', requireAuth, requireRole('owner'), (req, res) => {
  res.json({ sources: listSources({ includeArchived: req.query.archived === 'true' }) });
});

router.post('/sources', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const {
    name, type, expected_amount_usd, expected_amount_usd_cents,
    is_recurring, expected_day_of_month, is_active = true,
  } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  if (!VALID_SOURCE_TYPES.includes(type)) return res.status(400).json({ error: 'invalid type' });
  const cents = Number.isFinite(expected_amount_usd_cents)
    ? Math.round(expected_amount_usd_cents)
    : Number.isFinite(expected_amount_usd) ? Math.round(expected_amount_usd * 100) : 0;
  const day = expected_day_of_month != null ? Number(expected_day_of_month) : null;
  if (day != null && (day < 1 || day > 31)) {
    return res.status(400).json({ error: 'expected_day_of_month must be 1..31' });
  }
  const r = db
    .prepare(
      `INSERT INTO income_sources (name, type, expected_amount_usd_cents,
         is_recurring, expected_day_of_month, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name.trim(), type, cents, is_recurring ? 1 : 0, day, is_active ? 1 : 0);
  const row = db.prepare('SELECT * FROM income_sources WHERE id = ?').get(r.lastInsertRowid);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, after_json)
     VALUES (?, 'create', 'income_sources', ?)`
  ).run(req.user.id, JSON.stringify(row));
  res.json({ source: row });
});

router.put('/sources/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM income_sources WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const name = req.body?.name?.toString().trim() ?? existing.name;
  const type = req.body?.type ?? existing.type;
  if (!VALID_SOURCE_TYPES.includes(type)) return res.status(400).json({ error: 'invalid type' });
  let cents = existing.expected_amount_usd_cents;
  if (Number.isFinite(req.body?.expected_amount_usd_cents)) cents = Math.round(req.body.expected_amount_usd_cents);
  else if (Number.isFinite(req.body?.expected_amount_usd))  cents = Math.round(req.body.expected_amount_usd * 100);
  const day = req.body?.expected_day_of_month != null
    ? Number(req.body.expected_day_of_month)
    : existing.expected_day_of_month;
  const is_recurring = req.body?.is_recurring != null ? (req.body.is_recurring ? 1 : 0) : existing.is_recurring;
  const is_active    = req.body?.is_active    != null ? (req.body.is_active    ? 1 : 0) : existing.is_active;

  db.prepare(
    `UPDATE income_sources SET name = ?, type = ?, expected_amount_usd_cents = ?,
       is_recurring = ?, expected_day_of_month = ?, is_active = ?
     WHERE id = ?`
  ).run(name, type, cents, is_recurring, day, is_active, id);

  const after = db.prepare('SELECT * FROM income_sources WHERE id = ?').get(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'update', 'income_sources', ?, ?)`
  ).run(req.user.id, JSON.stringify(existing), JSON.stringify(after));
  res.json({ source: after });
});

router.delete('/sources/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM income_sources WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  // Archive (soft delete) — entries keep their FK reference.
  db.prepare("UPDATE income_sources SET archived_at = datetime('now'), is_active = 0 WHERE id = ?").run(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json)
     VALUES (?, 'archive', 'income_sources', ?)`
  ).run(req.user.id, JSON.stringify(existing));
  res.json({ ok: true });
});

// ---- entries ----

router.get('/entries', requireAuth, requireRole('owner'), (req, res) => {
  res.json({ entries: listEntries(req.query) });
});

router.post('/entries', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const {
    source_id, amount_usd_cents, amount_usd, received_date,
    expected_date, expected_amount_usd_cents, expected_amount_usd,
    note, status = 'received',
  } = req.body ?? {};

  const cents = Number.isFinite(amount_usd_cents)
    ? Math.round(amount_usd_cents)
    : Number.isFinite(amount_usd) ? Math.round(amount_usd * 100) : NaN;
  if (!Number.isFinite(cents) || cents <= 0) return res.status(400).json({ error: 'amount must be positive' });
  if (!DATE_RE.test(received_date || '')) return res.status(400).json({ error: 'received_date must be YYYY-MM-DD' });
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' });

  let expCents = null;
  if (Number.isFinite(expected_amount_usd_cents)) expCents = Math.round(expected_amount_usd_cents);
  else if (Number.isFinite(expected_amount_usd))  expCents = Math.round(expected_amount_usd * 100);

  const r = db
    .prepare(
      `INSERT INTO income_entries (source_id, amount_usd_cents, received_date,
         expected_date, expected_amount_usd_cents, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      source_id ?? null,
      cents,
      received_date,
      expected_date && DATE_RE.test(expected_date) ? expected_date : null,
      expCents,
      note?.toString().slice(0, 500) ?? null,
      status
    );
  const row = db.prepare('SELECT * FROM income_entries WHERE id = ?').get(r.lastInsertRowid);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, after_json)
     VALUES (?, 'create', 'income_entries', ?)`
  ).run(req.user.id, JSON.stringify(row));
  res.json({ entry: row });
});

router.put('/entries/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM income_entries WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  let cents = existing.amount_usd_cents;
  if (Number.isFinite(req.body?.amount_usd_cents)) cents = Math.round(req.body.amount_usd_cents);
  else if (Number.isFinite(req.body?.amount_usd))  cents = Math.round(req.body.amount_usd * 100);
  if (cents <= 0) return res.status(400).json({ error: 'amount must be positive' });

  const received_date = req.body?.received_date && DATE_RE.test(req.body.received_date)
    ? req.body.received_date : existing.received_date;
  const expected_date = req.body?.expected_date === null
    ? null
    : req.body?.expected_date && DATE_RE.test(req.body.expected_date)
      ? req.body.expected_date : existing.expected_date;
  const status = req.body?.status ?? existing.status;
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' });
  const source_id = req.body?.source_id !== undefined ? req.body.source_id : existing.source_id;
  const note = req.body?.note === undefined ? existing.note : (req.body.note?.toString().slice(0, 500) ?? null);

  db.prepare(
    `UPDATE income_entries
     SET source_id = ?, amount_usd_cents = ?, received_date = ?,
         expected_date = ?, note = ?, status = ?
     WHERE id = ?`
  ).run(source_id, cents, received_date, expected_date, note, status, id);

  const after = db.prepare('SELECT * FROM income_entries WHERE id = ?').get(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'update', 'income_entries', ?, ?)`
  ).run(req.user.id, JSON.stringify(existing), JSON.stringify(after));
  res.json({ entry: after });
});

router.delete('/entries/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM income_entries WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare("UPDATE income_entries SET deleted_at = datetime('now') WHERE id = ?").run(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json)
     VALUES (?, 'delete', 'income_entries', ?)`
  ).run(req.user.id, JSON.stringify(existing));
  res.json({ ok: true });
});

// ---- aggregate views ----

router.get('/forecast', requireAuth, requireRole('owner'), (req, res) => {
  res.json({ forecast: upcomingForecast() });
});

router.get('/summary', requireAuth, requireRole('owner'), (req, res) => {
  res.json({
    actual_this_month_usd_cents:   actualThisMonth(),
    expected_this_month_usd_cents: expectedThisMonth(),
    effective_monthly_usd_cents:   effectiveMonthlyIncome(),
    reliability_score:             reliabilityScore(),
    avg_delay_days:                averageDelayDays(),
  });
});

export default router;
