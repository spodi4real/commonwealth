import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requirePinChanged } from '../middleware/auth.js';
import {
  isSpendingCategory,
  isLockedCategory,
  isMomCategory,
} from '../lib/categories.js';
import { getCurrentRate } from '../lib/rates.js';
import {
  attachIqdFields,
  attachIqdFieldsOne,
} from '../lib/transactions.js';

const router = Router();

const VALID_TYPES = ['need', 'want', 'investment'];

// List transactions. Owner sees all; Mom sees only her own.
router.get('/', requireAuth, (req, res) => {
  const { userId, category, from, to, limit = 200, offset = 0, includeDeleted } = req.query;

  const where = [];
  const params = [];

  // Mom can only see her own transactions.
  if (req.user.role === 'mom') {
    where.push('user_id = ?');
    params.push(req.user.id);
  } else if (userId) {
    where.push('user_id = ?');
    params.push(Number(userId));
  }

  if (!includeDeleted) where.push('deleted_at IS NULL');

  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (from) { where.push('created_at >= ?'); params.push(from); }
  if (to)   { where.push('created_at <  ?'); params.push(to); }

  const sql =
    `SELECT t.id, t.user_id, u.name AS user_name, t.amount_usd_cents,
            t.category, t.note, t.type, t.created_at, t.deleted_at
     FROM transactions t JOIN users u ON u.id = t.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT ? OFFSET ?`;

  const rows = db.prepare(sql).all(...params, Number(limit), Number(offset));
  res.json({ transactions: attachIqdFields(rows) });
});

router.post('/', requireAuth, requirePinChanged, (req, res) => {
  const {
    amount_usd_cents,
    amount_usd,
    amount_iqd,
    category,
    note,
    type,
    created_at,
  } = req.body ?? {};

  if (!category) return res.status(400).json({ error: 'category required' });

  // Role-based category check.
  if (req.user.role === 'mom') {
    if (!isMomCategory(category)) {
      return res.status(403).json({ error: 'category not allowed for this user' });
    }
  } else {
    if (!isSpendingCategory(category) || isLockedCategory(category)) {
      return res.status(400).json({
        error: 'category must be a non-locked spending category. Locked savings categories receive value only through goal contributions.',
      });
    }
  }

  // Resolve amount → USD cents.
  let cents = null;
  if (Number.isFinite(amount_usd_cents)) {
    cents = Math.round(amount_usd_cents);
  } else if (Number.isFinite(amount_usd)) {
    cents = Math.round(amount_usd * 100);
  } else if (Number.isFinite(amount_iqd)) {
    const r = getCurrentRate();
    if (!r) return res.status(400).json({ error: 'no exchange rate set — owner must set one first' });
    cents = Math.round((Number(amount_iqd) / r.rate_iqd_per_usd) * 100);
  } else {
    return res.status(400).json({ error: 'amount required (amount_usd_cents, amount_usd, or amount_iqd)' });
  }
  if (cents <= 0) return res.status(400).json({ error: 'amount must be positive' });

  if (type != null && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${VALID_TYPES.join(', ')}` });
  }
  // Mom never classifies.
  const finalType = req.user.role === 'mom' ? null : (type ?? null);

  const finalNote = note?.toString().slice(0, 500) ?? null;
  // For created_at, accept ISO from the client (lets Owner backdate); otherwise now.
  const finalCreatedAt = created_at && /^\d{4}-\d{2}-\d{2}/.test(created_at)
    ? created_at.length === 10 ? `${created_at} 00:00:00` : created_at
    : new Date().toISOString().replace('T', ' ').slice(0, 19);

  const result = db
    .prepare(
      `INSERT INTO transactions (user_id, amount_usd_cents, category, note, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, cents, category, finalNote, finalType, finalCreatedAt);

  const row = db
    .prepare(
      `SELECT t.id, t.user_id, u.name AS user_name, t.amount_usd_cents,
              t.category, t.note, t.type, t.created_at, t.deleted_at
       FROM transactions t JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`
    )
    .get(result.lastInsertRowid);

  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, after_json)
     VALUES (?, 'create', 'transactions', ?)`
  ).run(req.user.id, JSON.stringify(row));

  res.json({ transaction: attachIqdFieldsOne(row) });
});

router.put('/:id', requireAuth, requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing || existing.deleted_at) return res.status(404).json({ error: 'not found' });

  // Mom can only edit her own.
  if (req.user.role === 'mom' && existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { amount_usd_cents, amount_usd, category, note, type, created_at } = req.body ?? {};

  let cents = existing.amount_usd_cents;
  if (Number.isFinite(amount_usd_cents)) cents = Math.round(amount_usd_cents);
  else if (Number.isFinite(amount_usd)) cents = Math.round(amount_usd * 100);
  if (cents <= 0) return res.status(400).json({ error: 'amount must be positive' });

  let cat = category ?? existing.category;
  if (req.user.role === 'mom') {
    if (!isMomCategory(cat)) return res.status(403).json({ error: 'category not allowed' });
  } else {
    if (!isSpendingCategory(cat) || isLockedCategory(cat)) {
      return res.status(400).json({ error: 'category not allowed' });
    }
  }

  let t = type === undefined ? existing.type : type;
  if (t != null && !VALID_TYPES.includes(t)) {
    return res.status(400).json({ error: 'invalid type' });
  }
  if (req.user.role === 'mom') t = null;

  const finalNote = note === undefined ? existing.note : (note?.toString().slice(0, 500) ?? null);

  let finalCreatedAt = existing.created_at;
  if (created_at && /^\d{4}-\d{2}-\d{2}/.test(created_at)) {
    finalCreatedAt = created_at.length === 10 ? `${created_at} 00:00:00` : created_at;
  }

  db.prepare(
    `UPDATE transactions
     SET amount_usd_cents = ?, category = ?, note = ?, type = ?, created_at = ?
     WHERE id = ?`
  ).run(cents, cat, finalNote, t, finalCreatedAt, id);

  const after = db
    .prepare(
      `SELECT t.id, t.user_id, u.name AS user_name, t.amount_usd_cents,
              t.category, t.note, t.type, t.created_at, t.deleted_at
       FROM transactions t JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`
    )
    .get(id);

  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'update', 'transactions', ?, ?)`
  ).run(req.user.id, JSON.stringify(existing), JSON.stringify(after));

  res.json({ transaction: attachIqdFieldsOne(after) });
});

// Soft delete. Nothing is ever hard-deleted — patterns over years matter
// more than a clean current list.
router.delete('/:id', requireAuth, requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing || existing.deleted_at) return res.status(404).json({ error: 'not found' });

  if (req.user.role === 'mom' && existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'forbidden' });
  }

  db.prepare('UPDATE transactions SET deleted_at = datetime(\'now\') WHERE id = ?').run(id);

  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json)
     VALUES (?, 'delete', 'transactions', ?)`
  ).run(req.user.id, JSON.stringify(existing));

  res.json({ ok: true });
});

export default router;
