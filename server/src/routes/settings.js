import { Router } from 'express';
import {
  requireAuth, requireRole, requirePinChanged,
} from '../middleware/auth.js';
import { allSettings, setSetting } from '../lib/settings.js';

const router = Router();

const EDITABLE = new Set([
  'monthly_income_usd_cents',
  'friction_threshold_usd',
  'mom_auto_approve_usd',
  'mom_hard_limit_usd',
]);

router.get('/', requireAuth, requireRole('owner'), (req, res) => {
  res.json({ settings: allSettings() });
});

router.put('/:key', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const key = req.params.key;
  if (!EDITABLE.has(key)) return res.status(400).json({ error: 'not an editable setting' });
  const { value } = req.body ?? {};
  if (value === undefined) return res.status(400).json({ error: 'value required' });
  setSetting(key, value);
  res.json({ ok: true, key, value });
});

export default router;
