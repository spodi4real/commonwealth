import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requirePinChanged } from '../middleware/auth.js';
import { isMomCategory } from '../lib/categories.js';
import { evaluateCanISpend, createApprovalRequest, getMomAllowance } from '../lib/mom.js';

const router = Router();

router.post('/can-i-spend', requireAuth, requirePinChanged, (req, res) => {
  if (req.user.role !== 'mom') {
    return res.status(403).json({ error: 'this endpoint is for Mom' });
  }
  const { amount_iqd, category } = req.body ?? {};
  if (!isMomCategory(category)) {
    return res.status(400).json({ error: 'invalid category for this user' });
  }
  const n = Number(amount_iqd);
  if (!Number.isFinite(n) || n <= 0) {
    return res.status(400).json({ error: 'amount_iqd must be positive' });
  }

  const result = evaluateCanISpend({ amount_iqd: n, category });

  if (result.verdict === 'amber') {
    const reqRow = createApprovalRequest({ amount_iqd: n, category });
    return res.json({ ...result, request: reqRow });
  }

  res.json(result);
});

// Mom polls this to check whether her amber request has been resolved.
router.get('/can-i-spend/:id', requireAuth, requirePinChanged, (req, res) => {
  if (req.user.role !== 'mom') return res.status(403).json({ error: 'forbidden' });
  const row = db
    .prepare('SELECT * FROM mom_approval_requests WHERE id = ?')
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ request: row });
});

router.get('/today-allowance', requireAuth, (req, res) => {
  res.json(getMomAllowance());
});

export default router;
