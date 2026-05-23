import { db } from '../db.js';

// Deterministic by day-of-year so the same day shows the same principle
// across page loads. Feels intentional, not random.
export function getTodaysPrinciple() {
  const principles = db.prepare('SELECT id, text FROM wealth_principles ORDER BY id').all();
  if (!principles.length) return null;

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000);
  return principles[dayOfYear % principles.length];
}

export function listAllPrinciples() {
  return db.prepare('SELECT id, text FROM wealth_principles ORDER BY id').all();
}
