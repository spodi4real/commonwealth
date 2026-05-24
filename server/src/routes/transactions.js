import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requirePinChanged } from '../middleware/auth.js';
import {
  isSpendingCategory, isLockedCategory, isMomCategory,
} from '../lib/categories.js';
import { getCurrentRate } from '../lib/rates.js';
import { attachIqdFields, attachIqdFieldsOne } from '../lib/transactions.js';
import { receiptUpload, deleteReceipt } from '../lib/uploads.js';

const router = Router();
const VALID_TYPES = ['need', 'want', 'investment'];

// Common SELECT — keep the column list in one place so any new column added
// in a migration shows up here automatically once we list it.
const TX_COLS = `t.id, t.user_id, u.name AS user_name, t.amount_usd_cents,
                 t.category, t.name, t.note, t.type, t.receipt_path,
                 t.created_at, t.deleted_at`;

router.get('/', requireAuth, (req, res) => {
  const { userId, category, from, to, limit = 200, offset = 0, includeDeleted } = req.query;
  const where = [];
  const params = [];

  if (req.user.role === 'mom') {
    where.push('user_id = ?');
    params.push(req.user.id);
  } else if (userId) {
    where.push('user_id = ?');
    params.push(Number(userId));
  }
  if (!includeDeleted) where.push('deleted_at IS NULL');
  if (category) { where.push('category = ?'); params.push(category); }
  if (from)     { where.push('created_at >= ?'); params.push(from); }
  if (to)       { where.push('created_at <  ?'); params.push(to); }

  const sql =
    `SELECT ${TX_COLS}
     FROM transactions t JOIN users u ON u.id = t.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, Number(limit), Number(offset));
  res.json({ transactions: attachIqdFields(rows) });
});

function selectOne(id) {
  return db
    .prepare(
      `SELECT ${TX_COLS}
       FROM transactions t JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`
    )
    .get(id);
}

router.post('/', requireAuth, requirePinChanged, (req, res) => {
  const {
    amount_usd_cents, amount_usd, amount_iqd,
    category, name, note, type, created_at,
  } = req.body ?? {};

  if (!category) return res.status(400).json({ error: 'category required' });

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

  let cents = null;
  if (Number.isFinite(amount_usd_cents))      cents = Math.round(amount_usd_cents);
  else if (Number.isFinite(amount_usd))       cents = Math.round(amount_usd * 100);
  else if (Number.isFinite(amount_iqd)) {
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
  const finalType = req.user.role === 'mom' ? null : (type ?? null);
  const finalName = name?.toString().trim().slice(0, 120) || null;
  const finalNote = note?.toString().slice(0, 1000) ?? null;
  const finalCreatedAt = created_at && /^\d{4}-\d{2}-\d{2}/.test(created_at)
    ? (created_at.length === 10 ? `${created_at} 00:00:00` : created_at)
    : new Date().toISOString().replace('T', ' ').slice(0, 19);

  const result = db
    .prepare(
      `INSERT INTO transactions (user_id, amount_usd_cents, category, name, note, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, cents, category, finalName, finalNote, finalType, finalCreatedAt);

  const row = selectOne(result.lastInsertRowid);
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

  // Mom is read-only on her own purchases (v1.1). Exception: returns — see
  // /:id/return below.
  if (req.user.role === 'mom') {
    return res.status(403).json({ error: 'ask Owner to edit this' });
  }

  const { amount_usd_cents, amount_usd, category, name, note, type, created_at } = req.body ?? {};

  let cents = existing.amount_usd_cents;
  if (Number.isFinite(amount_usd_cents)) cents = Math.round(amount_usd_cents);
  else if (Number.isFinite(amount_usd))  cents = Math.round(amount_usd * 100);
  if (cents <= 0) return res.status(400).json({ error: 'amount must be positive' });

  const cat = category ?? existing.category;
  if (!isSpendingCategory(cat) || isLockedCategory(cat)) {
    return res.status(400).json({ error: 'category not allowed' });
  }

  let t = type === undefined ? existing.type : type;
  if (t != null && !VALID_TYPES.includes(t)) return res.status(400).json({ error: 'invalid type' });

  const finalName = name === undefined ? existing.name : (name?.toString().trim().slice(0, 120) || null);
  const finalNote = note === undefined ? existing.note : (note?.toString().slice(0, 1000) ?? null);
  let finalCreatedAt = existing.created_at;
  if (created_at && /^\d{4}-\d{2}-\d{2}/.test(created_at)) {
    finalCreatedAt = created_at.length === 10 ? `${created_at} 00:00:00` : created_at;
  }

  db.prepare(
    `UPDATE transactions
     SET amount_usd_cents = ?, category = ?, name = ?, note = ?, type = ?, created_at = ?
     WHERE id = ?`
  ).run(cents, cat, finalName, finalNote, t, finalCreatedAt, id);

  const after = selectOne(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'update', 'transactions', ?, ?)`
  ).run(req.user.id, JSON.stringify(existing), JSON.stringify(after));

  res.json({ transaction: attachIqdFieldsOne(after) });
});

router.delete('/:id', requireAuth, requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing || existing.deleted_at) return res.status(404).json({ error: 'not found' });
  if (req.user.role === 'mom') return res.status(403).json({ error: 'ask Owner to remove this' });

  db.prepare("UPDATE transactions SET deleted_at = datetime('now') WHERE id = ?").run(id);
  // Keep the receipt file on disk — useful for audit. Comment in if you'd
  // rather hard-clean: if (existing.receipt_path) deleteReceipt(existing.receipt_path);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json)
     VALUES (?, 'delete', 'transactions', ?)`
  ).run(req.user.id, JSON.stringify(existing));
  res.json({ ok: true });
});

// Soft-deletes the transaction with a 'return' audit action. Mom is allowed
// to return her own purchases — the v1.1 read-only rule covers arbitrary
// edits, not returns, because returns reflect the truth changing rather
// than being rewritten.
router.post('/:id/return', requireAuth, requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing || existing.deleted_at) return res.status(404).json({ error: 'not found' });
  if (req.user.role === 'mom' && existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'can only return your own purchase' });
  }
  const reason = req.body?.reason?.toString().slice(0, 200) ?? null;
  db.prepare("UPDATE transactions SET deleted_at = datetime('now') WHERE id = ?").run(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'return', 'transactions', ?, ?)`
  ).run(req.user.id, JSON.stringify(existing), JSON.stringify({ reason }));
  res.json({ ok: true });
});

// Receipt upload. multer writes the file to receipts/ then we update the row.
// Two-step (POST tx → POST receipt) keeps the JSON body simple.
router.post('/:id/receipt', requireAuth, requirePinChanged, receiptUpload.single('receipt'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) {
    if (req.file?.path) deleteReceipt(req.file.filename);
    return res.status(404).json({ error: 'transaction not found' });
  }
  if (req.user.role === 'mom' && existing.user_id !== req.user.id) {
    if (req.file?.filename) deleteReceipt(req.file.filename);
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' });

  // Remove previous receipt if any.
  if (existing.receipt_path) deleteReceipt(existing.receipt_path);

  db.prepare('UPDATE transactions SET receipt_path = ? WHERE id = ?').run(req.file.filename, id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, after_json)
     VALUES (?, 'receipt', 'transactions', ?)`
  ).run(req.user.id, JSON.stringify({ id, filename: req.file.filename }));

  res.json({ receipt_path: req.file.filename });
});

router.delete('/:id/receipt', requireAuth, requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (req.user.role === 'mom') return res.status(403).json({ error: 'ask Owner to remove this' });
  if (existing.receipt_path) deleteReceipt(existing.receipt_path);
  db.prepare('UPDATE transactions SET receipt_path = NULL WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
