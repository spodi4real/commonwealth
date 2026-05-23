import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import {
  createSession,
  destroySession,
  COOKIE_NAME,
  cookieOptions,
} from '../session.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public list of users for the login screen (no PINs, no hashes).
router.get('/users', (req, res) => {
  const rows = db.prepare('SELECT id, name, role FROM users ORDER BY id').all();
  res.json({ users: rows });
});

router.post('/login', (req, res) => {
  const { userId, pin } = req.body ?? {};
  if (!userId || !pin) return res.status(400).json({ error: 'userId and pin required' });

  const user = db
    .prepare('SELECT id, name, role, pin_hash, must_change_pin FROM users WHERE id = ?')
    .get(userId);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = bcrypt.compareSync(String(pin), user.pin_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  const token = createSession(user.id);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      mustChangePin: !!user.must_change_pin,
    },
  });
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  destroySession(token);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-pin', requireAuth, (req, res) => {
  const { currentPin, newPin } = req.body ?? {};
  if (!currentPin || !newPin) {
    return res.status(400).json({ error: 'currentPin and newPin required' });
  }
  if (!/^\d{4}$/.test(String(newPin))) {
    return res.status(400).json({ error: 'newPin must be 4 digits' });
  }
  if (String(currentPin) === String(newPin)) {
    return res.status(400).json({ error: 'new PIN must differ from current PIN' });
  }

  const row = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(401).json({ error: 'not authenticated' });

  const ok = bcrypt.compareSync(String(currentPin), row.pin_hash);
  if (!ok) return res.status(401).json({ error: 'current PIN is incorrect' });

  const hash = bcrypt.hashSync(String(newPin), 10);
  db.prepare('UPDATE users SET pin_hash = ?, must_change_pin = 0 WHERE id = ?').run(
    hash,
    req.user.id
  );

  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, after_json)
     VALUES (?, 'change_pin', 'users', ?)`
  ).run(req.user.id, JSON.stringify({ id: req.user.id }));

  res.json({ ok: true });
});

export default router;
