import { Router } from 'express';
import { db } from '../db.js';
import {
  requireAuth, requireRole, requirePinChanged,
} from '../middleware/auth.js';
import { listCashAccounts, totalCashUsdCents, syncIqdAccountUsd } from '../lib/cash.js';
import { getCurrentRate } from '../lib/rates.js';

const router = Router();

const VALID_TYPES = ['cash_iqd','cash_usd','bank','other'];

router.get('/', requireAuth, requireRole('owner'), (req, res) => {
  res.json({
    accounts: listCashAccounts({ includeArchived: req.query.archived === 'true' }),
    total_usd_cents: totalCashUsdCents(),
    rate: getCurrentRate(),
  });
});

router.post('/', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const { name, type, balance_usd_cents, balance_usd, balance_iqd, notes } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'invalid type' });

  let cents = 0;
  if (Number.isFinite(balance_usd_cents)) cents = Math.round(balance_usd_cents);
  else if (Number.isFinite(balance_usd))  cents = Math.round(balance_usd * 100);
  else if (type === 'cash_iqd' && Number.isFinite(balance_iqd)) {
    const rate = getCurrentRate();
    if (!rate) return res.status(400).json({ error: 'set an exchange rate first to enter IQD balances' });
    cents = Math.round((Number(balance_iqd) / rate.rate_iqd_per_usd) * 100);
  }
  if (cents < 0) return res.status(400).json({ error: 'balance must be non-negative' });

  const r = db
    .prepare(
      `INSERT INTO cash_accounts (name, type, balance_usd_cents, balance_iqd, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      name.trim(),
      type,
      cents,
      type === 'cash_iqd' && Number.isFinite(balance_iqd) ? Math.round(balance_iqd) : null,
      notes?.toString().slice(0, 500) ?? null
    );

  const row = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(r.lastInsertRowid);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, after_json)
     VALUES (?, 'create', 'cash_accounts', ?)`
  ).run(req.user.id, JSON.stringify(row));
  res.json({ account: row });
});

router.put('/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const name = req.body?.name?.toString().trim() ?? existing.name;
  const type = req.body?.type ?? existing.type;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'invalid type' });

  let cents = existing.balance_usd_cents;
  let iqd = existing.balance_iqd;

  if (Number.isFinite(req.body?.balance_usd_cents)) cents = Math.round(req.body.balance_usd_cents);
  else if (Number.isFinite(req.body?.balance_usd))  cents = Math.round(req.body.balance_usd * 100);
  else if (type === 'cash_iqd' && Number.isFinite(req.body?.balance_iqd)) {
    const rate = getCurrentRate();
    if (rate) {
      iqd = Math.round(req.body.balance_iqd);
      cents = Math.round((iqd / rate.rate_iqd_per_usd) * 100);
    }
  }

  const notes = req.body?.notes === undefined ? existing.notes : (req.body.notes?.toString().slice(0, 500) ?? null);

  db.prepare(
    `UPDATE cash_accounts SET name = ?, type = ?, balance_usd_cents = ?, balance_iqd = ?, notes = ?
     WHERE id = ?`
  ).run(name, type, cents, iqd, notes, id);

  if (type === 'cash_iqd') syncIqdAccountUsd(id);

  const after = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'update', 'cash_accounts', ?, ?)`
  ).run(req.user.id, JSON.stringify(existing), JSON.stringify(after));
  res.json({ account: after });
});

router.delete('/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare("UPDATE cash_accounts SET archived_at = datetime('now') WHERE id = ?").run(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json)
     VALUES (?, 'archive', 'cash_accounts', ?)`
  ).run(req.user.id, JSON.stringify(existing));
  res.json({ ok: true });
});

export default router;
