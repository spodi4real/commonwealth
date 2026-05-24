import { Router } from 'express';
import { db } from '../db.js';
import {
  requireAuth, requireRole, requirePinChanged,
} from '../middleware/auth.js';
import { currentMonth } from '../lib/dates.js';

const router = Router();
const MONTH_RE = /^\d{4}-\d{2}$/;

export const REVIEW_QUESTIONS = [
  "What was last month's biggest financial win?",
  "What was the biggest leak?",
  "What is one decision you will make differently?",
  "Are you closer or further from generational wealth than 30 days ago?",
  "What is the single most important financial action for this month?",
];

function previousMonth() {
  const m = currentMonth();
  const [y, mo] = m.split('-').map(Number);
  const prev = mo === 1
    ? `${y - 1}-12`
    : `${y}-${String(mo - 1).padStart(2, '0')}`;
  return prev;
}

router.get('/questions', requireAuth, (req, res) => {
  res.json({ questions: REVIEW_QUESTIONS });
});

// Returns whether the user should be prompted for a review of the prior
// month right now: it's not yet been answered.
router.get('/prompt', requireAuth, requireRole('owner'), (req, res) => {
  const prev = previousMonth();
  const row = db.prepare('SELECT id FROM monthly_reviews WHERE month = ?').get(prev);
  res.json({
    needs_review: !row,
    month: prev,
    questions: REVIEW_QUESTIONS,
  });
});

router.get('/', requireAuth, requireRole('owner'), (req, res) => {
  const rows = db
    .prepare('SELECT * FROM monthly_reviews ORDER BY month DESC')
    .all();
  res.json({ reviews: rows.map((r) => ({ ...r, questions: REVIEW_QUESTIONS })) });
});

router.get('/:month', requireAuth, requireRole('owner'), (req, res) => {
  const { month } = req.params;
  if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'bad month' });
  const row = db.prepare('SELECT * FROM monthly_reviews WHERE month = ?').get(month);
  if (!row) return res.json({ review: null, questions: REVIEW_QUESTIONS });
  res.json({ review: row, questions: REVIEW_QUESTIONS });
});

router.post('/', requireAuth, requireRole('owner'), requirePinChanged, (req, res) => {
  const { month, q1, q2, q3, q4, q5 } = req.body ?? {};
  if (!MONTH_RE.test(month || '')) return res.status(400).json({ error: 'month must be YYYY-MM' });
  const answers = [q1, q2, q3, q4, q5].map((a) => a?.toString().trim().slice(0, 2000) ?? '');
  if (answers.some((a) => a.length === 0)) {
    return res.status(400).json({ error: 'all five answers are required' });
  }

  const existing = db.prepare('SELECT * FROM monthly_reviews WHERE month = ?').get(month);
  if (existing) {
    db.prepare(
      'UPDATE monthly_reviews SET q1 = ?, q2 = ?, q3 = ?, q4 = ?, q5 = ? WHERE id = ?'
    ).run(...answers, existing.id);
    db.prepare(
      `INSERT INTO audit_log (user_id, action, entity, before_json, after_json)
       VALUES (?, 'update', 'monthly_reviews', ?, ?)`
    ).run(req.user.id, JSON.stringify(existing), JSON.stringify({ ...existing, q1: answers[0], q2: answers[1], q3: answers[2], q4: answers[3], q5: answers[4] }));
  } else {
    const r = db
      .prepare(
        'INSERT INTO monthly_reviews (month, q1, q2, q3, q4, q5) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(month, ...answers);
    const row = db.prepare('SELECT * FROM monthly_reviews WHERE id = ?').get(r.lastInsertRowid);
    db.prepare(
      `INSERT INTO audit_log (user_id, action, entity, after_json)
       VALUES (?, 'create', 'monthly_reviews', ?)`
    ).run(req.user.id, JSON.stringify(row));
  }

  const after = db.prepare('SELECT * FROM monthly_reviews WHERE month = ?').get(month);
  res.json({ review: after });
});

export default router;
