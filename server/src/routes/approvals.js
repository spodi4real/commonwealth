import { Router } from 'express';
import { db } from '../db.js';
import {
  requireAuth, requireRole, requirePinChanged,
} from '../middleware/auth.js';

const router = Router();

// Owner sees the queue. Mom can only see her own list of recent requests
// (for the "your asks" timeline on her screen).
router.get('/', requireAuth, (req, res) => {
  const { status = 'pending' } = req.query;
  if (req.user.role === 'mom') {
    const rows = db
      .prepare(
        `SELECT * FROM mom_approval_requests
         WHERE status = ? ORDER BY created_at DESC LIMIT 50`
      )
      .all(status);
    return res.json({ requests: rows });
  }
  const rows = status === 'all'
    ? db.prepare('SELECT * FROM mom_approval_requests ORDER BY created_at DESC LIMIT 100').all()
    : db.prepare('SELECT * FROM mom_approval_requests WHERE status = ? ORDER BY created_at DESC LIMIT 100').all(status);
  res.json({ requests: rows });
});

router.post('/:id/approve', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const { ownerNote } = req.body ?? {};
  const row = db.prepare('SELECT * FROM mom_approval_requests WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'already resolved' });

  db.prepare(
    `UPDATE mom_approval_requests
     SET status = 'approved', owner_note = ?, resolved_at = datetime('now')
     WHERE id = ?`
  ).run(ownerNote?.toString().slice(0, 200) ?? null, id);

  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'approve', 'mom_approval_requests', ?, ?)`
  ).run(req.user.id, JSON.stringify(row), JSON.stringify({ ...row, status: 'approved', owner_note: ownerNote ?? null }));

  const after = db.prepare('SELECT * FROM mom_approval_requests WHERE id = ?').get(id);
  res.json({ request: after });
});

// Owner override — can change status of any request (correct mistakes, reopen
// resolved items, etc). Writes a full audit_log entry like every other edit.
router.put('/:id', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM mom_approval_requests WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const status = req.body?.status ?? existing.status;
  const VALID = ['pending', 'approved', 'denied'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'invalid status' });

  const owner_note = req.body?.owner_note !== undefined
    ? req.body.owner_note?.toString().slice(0, 200) ?? null
    : existing.owner_note;
  const resolved_at = status === 'pending' ? null : (existing.resolved_at ?? new Date().toISOString().replace('T', ' ').slice(0, 19));

  db.prepare(
    `UPDATE mom_approval_requests SET status = ?, owner_note = ?, resolved_at = ? WHERE id = ?`
  ).run(status, owner_note, resolved_at, id);

  const after = db.prepare('SELECT * FROM mom_approval_requests WHERE id = ?').get(id);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'override', 'mom_approval_requests', ?, ?)`
  ).run(req.user.id, JSON.stringify(existing), JSON.stringify(after));
  res.json({ request: after });
});

router.post('/:id/deny', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const id = Number(req.params.id);
  const { ownerNote } = req.body ?? {};
  const row = db.prepare('SELECT * FROM mom_approval_requests WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'already resolved' });

  db.prepare(
    `UPDATE mom_approval_requests
     SET status = 'denied', owner_note = ?, resolved_at = datetime('now')
     WHERE id = ?`
  ).run(ownerNote?.toString().slice(0, 200) ?? null, id);

  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
     VALUES (?, 'deny', 'mom_approval_requests', ?, ?)`
  ).run(req.user.id, JSON.stringify(row), JSON.stringify({ ...row, status: 'denied', owner_note: ownerNote ?? null }));

  const after = db.prepare('SELECT * FROM mom_approval_requests WHERE id = ?').get(id);
  res.json({ request: after });
});

export default router;
