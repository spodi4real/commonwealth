import { Router } from 'express';
import { db } from '../db.js';
import {
  requireAuth, requireRole, requirePinChanged,
} from '../middleware/auth.js';
import { isSpendingCategory, isLockedCategory } from '../lib/categories.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { resolved } = req.query;
  const where = ['user_id = ?'];
  const params = [req.user.id];
  if (resolved === 'true')      where.push('resolved_at IS NOT NULL');
  else if (resolved === 'all') {/* no filter */}
  else                          where.push('resolved_at IS NULL');

  const rows = db
    .prepare(
      `SELECT id, user_id, amount_usd_cents, category, note, created_at,
              resolved_at, kept
       FROM pending_desires
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT 200`
    )
    .all(...params);
  res.json({ desires: rows });
});

router.post('/', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const { amount_usd_cents, amount_usd, category, note } = req.body ?? {};
  const cents = Number.isFinite(amount_usd_cents)
    ? Math.round(amount_usd_cents)
    : Number.isFinite(amount_usd) ? Math.round(amount_usd * 100) : NaN;
  if (!Number.isFinite(cents) || cents <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
  }
  if (!isSpendingCategory(category) || isLockedCategory(category)) {
    return res.status(400).json({ error: 'category not allowed' });
  }
  const finalNote = note?.toString().slice(0, 500) ?? null;

  const r = db
    .prepare(
      `INSERT INTO pending_desires (user_id, amount_usd_cents, category, note)
       VALUES (?, ?, ?, ?)`
    )
    .run(req.user.id, cents, category, finalNote);

  const row = db.prepare('SELECT * FROM pending_desires WHERE id = ?').get(r.lastInsertRowid);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, after_json)
     VALUES (?, 'create', 'pending_desires', ?)`
  ).run(req.user.id, JSON.stringify(row));
  res.json({ desire: row });
});

// "Yes, I still want it" — promotes to a real transaction (type=want).
router.post('/:id/keep', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const d = db.prepare('SELECT * FROM pending_desires WHERE id = ? AND resolved_at IS NULL').get(id);
  if (!d) return res.status(404).json({ error: 'not found or already resolved' });
  if (d.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });

  // Wrap both writes in a transaction.
  const result = db.transaction(() => {
    db.prepare('UPDATE pending_desires SET kept = 1, resolved_at = datetime(\'now\') WHERE id = ?').run(id);
    const r = db
      .prepare(
        `INSERT INTO transactions (user_id, amount_usd_cents, category, note, type)
         VALUES (?, ?, ?, ?, 'want')`
      )
      .run(d.user_id, d.amount_usd_cents, d.category, d.note);
    return db
      .prepare(
        `SELECT t.id, t.user_id, u.name AS user_name, t.amount_usd_cents,
                t.category, t.note, t.type, t.created_at
         FROM transactions t JOIN users u ON u.id = t.user_id
         WHERE t.id = ?`
      )
      .get(r.lastInsertRowid);
  })();

  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'resolve_kept', 'pending_desires', ?, ?)`
  ).run(req.user.id, JSON.stringify(d), JSON.stringify(result));

  res.json({ transaction: result });
});

// "No, I didn't need it" — abandons. Counts toward saved-by-friction.
router.post('/:id/abandon', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const d = db.prepare('SELECT * FROM pending_desires WHERE id = ? AND resolved_at IS NULL').get(id);
  if (!d) return res.status(404).json({ error: 'not found or already resolved' });
  if (d.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });

  db.prepare('UPDATE pending_desires SET kept = 0, resolved_at = datetime(\'now\') WHERE id = ?').run(id);

  const after = db.prepare('SELECT * FROM pending_desires WHERE id = ?').get(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'resolve_abandon', 'pending_desires', ?, ?)`
  ).run(req.user.id, JSON.stringify(d), JSON.stringify(after));

  res.json({ desire: after });
});

router.delete('/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const d = db.prepare('SELECT * FROM pending_desires WHERE id = ?').get(id);
  if (!d) return res.status(404).json({ error: 'not found' });
  if (d.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM pending_desires WHERE id = ?').run(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json)
     VALUES (?, 'delete', 'pending_desires', ?)`
  ).run(req.user.id, JSON.stringify(d));
  res.json({ ok: true });
});

export default router;
