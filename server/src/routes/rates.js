import { Router } from 'express';
import { db } from '../db.js';
import {
  requireAuth,
  requireRole,
  requirePinChanged,
} from '../middleware/auth.js';
import { getCurrentRate, getRateOnOrBefore, listRates } from '../lib/rates.js';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Any authenticated user — Mom needs the current rate to convert IQD→USD
// when she logs spending. Conversion stays a display-layer concern.
router.get('/current', requireAuth, (req, res) => {
  res.json({ rate: getCurrentRate() });
});

router.get('/for-date', requireAuth, (req, res) => {
  const { date } = req.query;
  if (!DATE_RE.test(date || '')) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  res.json({ rate: getRateOnOrBefore(date) });
});

// Owner-only history.
router.get('/', requireAuth, requireRole('owner'), (req, res) => {
  const { from, to } = req.query;
  res.json({ rates: listRates({ from, to }) });
});

router.post('/', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const { rate, effectiveDate } = req.body ?? {};
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) {
    return res.status(400).json({ error: 'rate must be a positive number' });
  }
  if (!DATE_RE.test(effectiveDate || '')) {
    return res.status(400).json({ error: 'effectiveDate must be YYYY-MM-DD' });
  }

  // Idempotent per day: update if a rate already exists for this date.
  const existing = db
    .prepare('SELECT id, rate_iqd_per_usd, effective_date FROM exchange_rates WHERE effective_date = ?')
    .get(effectiveDate);

  if (existing) {
    db.prepare('UPDATE exchange_rates SET rate_iqd_per_usd = ? WHERE id = ?').run(n, existing.id);
    db.prepare(
      `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
       VALUES (?, 'update', 'exchange_rates', ?, ?)`
    ).run(
      req.user.id,
      JSON.stringify(existing),
      JSON.stringify({ id: existing.id, rate_iqd_per_usd: n, effective_date: effectiveDate })
    );
    const row = db.prepare('SELECT * FROM exchange_rates WHERE id = ?').get(existing.id);
    return res.json({ rate: row, updated: true });
  }

  const result = db
    .prepare('INSERT INTO exchange_rates (rate_iqd_per_usd, effective_date) VALUES (?, ?)')
    .run(n, effectiveDate);
  const row = db.prepare('SELECT * FROM exchange_rates WHERE id = ?').get(result.lastInsertRowid);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, after_json)
     VALUES (?, 'create', 'exchange_rates', ?)`
  ).run(req.user.id, JSON.stringify(row));
  res.json({ rate: row, updated: false });
});

router.delete('/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM exchange_rates WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM exchange_rates WHERE id = ?').run(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json)
     VALUES (?, 'delete', 'exchange_rates', ?)`
  ).run(req.user.id, JSON.stringify(existing));
  res.json({ ok: true });
});

export default router;
