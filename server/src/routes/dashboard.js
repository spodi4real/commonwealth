import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getDashboard } from '../lib/dashboard.js';
import { getTodaysPrinciple } from '../lib/principles.js';

const router = Router();

router.get('/', requireAuth, requireRole('owner'), (req, res) => {
  res.json(getDashboard());
});

router.get('/principle/today', requireAuth, (req, res) => {
  res.json({ principle: getTodaysPrinciple() });
});

export default router;
