import { Router } from 'express';
import { db } from '../db.js';
import {
  requireAuth, requireRole, requirePinChanged,
} from '../middleware/auth.js';
import { listGoalsEnriched, listContributions } from '../lib/goals.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.json({ goals: listGoalsEnriched() });
});

router.post('/', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const { name, target_usd_cents, target_usd } = req.body ?? {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
  const cents = Number.isFinite(target_usd_cents)
    ? Math.round(target_usd_cents)
    : Number.isFinite(target_usd) ? Math.round(target_usd * 100) : NaN;
  if (!Number.isFinite(cents) || cents <= 0) return res.status(400).json({ error: 'target must be positive' });

  try {
    const r = db.prepare('INSERT INTO goals (name, target_usd_cents) VALUES (?, ?)').run(name.trim(), cents);
    const row = db.prepare('SELECT * FROM goals WHERE id = ?').get(r.lastInsertRowid);
    db.prepare(
      `INSERT INTO audit_log (user_id, action, entity, after_json)
       VALUES (?, 'create', 'goals', ?)`
    ).run(req.user.id, JSON.stringify(row));
    res.json({ goal: row });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'a goal with that name already exists' });
    }
    throw e;
  }
});

router.put('/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const name = req.body?.name?.toString().trim() ?? existing.name;
  let cents = existing.target_usd_cents;
  if (Number.isFinite(req.body?.target_usd_cents)) cents = Math.round(req.body.target_usd_cents);
  else if (Number.isFinite(req.body?.target_usd))  cents = Math.round(req.body.target_usd * 100);
  if (cents <= 0) return res.status(400).json({ error: 'target must be positive' });

  db.prepare('UPDATE goals SET name = ?, target_usd_cents = ? WHERE id = ?').run(name, cents, id);
  const after = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'update', 'goals', ?, ?)`
  ).run(req.user.id, JSON.stringify(existing), JSON.stringify(after));
  res.json({ goal: after });
});

router.delete('/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  // Cascade contributions for cleanliness.
  db.prepare('DELETE FROM goal_contributions WHERE goal_id = ?').run(id);
  db.prepare('DELETE FROM goals WHERE id = ?').run(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json)
     VALUES (?, 'delete', 'goals', ?)`
  ).run(req.user.id, JSON.stringify(existing));
  res.json({ ok: true });
});

router.get('/:id/contributions', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  res.json({ contributions: listContributions(id) });
});

router.post('/:id/contributions', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const goal = db.prepare('SELECT id FROM goals WHERE id = ?').get(id);
  if (!goal) return res.status(404).json({ error: 'goal not found' });

  const { amount_usd_cents, amount_usd, contributed_at } = req.body ?? {};
  const cents = Number.isFinite(amount_usd_cents)
    ? Math.round(amount_usd_cents)
    : Number.isFinite(amount_usd) ? Math.round(amount_usd * 100) : NaN;
  if (!Number.isFinite(cents) || cents <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
  }

  const when = contributed_at && /^\d{4}-\d{2}-\d{2}/.test(contributed_at)
    ? (contributed_at.length === 10 ? `${contributed_at} 00:00:00` : contributed_at)
    : new Date().toISOString().replace('T', ' ').slice(0, 19);

  const r = db
    .prepare('INSERT INTO goal_contributions (goal_id, amount_usd_cents, contributed_at) VALUES (?, ?, ?)')
    .run(id, cents, when);

  const row = db.prepare('SELECT * FROM goal_contributions WHERE id = ?').get(r.lastInsertRowid);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, after_json)
     VALUES (?, 'create', 'goal_contributions', ?)`
  ).run(req.user.id, JSON.stringify(row));
  res.json({ contribution: row });
});

router.delete('/contributions/:cid', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const cid = Number(req.params.cid);
  const row = db.prepare('SELECT * FROM goal_contributions WHERE id = ?').get(cid);
  if (!row) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM goal_contributions WHERE id = ?').run(cid);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json)
     VALUES (?, 'delete', 'goal_contributions', ?)`
  ).run(req.user.id, JSON.stringify(row));
  res.json({ ok: true });
});

export default router;
