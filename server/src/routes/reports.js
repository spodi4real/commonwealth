import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getReports } from '../lib/reports.js';
import { currentMonth } from '../lib/dates.js';

const router = Router();
const MONTH_RE = /^\d{4}-\d{2}$/;

router.get('/', requireAuth, requireRole('owner'), (req, res) => {
  const month = req.query.month && MONTH_RE.test(req.query.month) ? req.query.month : currentMonth();
  res.json(getReports({ month }));
});

export default router;
