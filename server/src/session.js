import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_DAYS = 30;
export const COOKIE_NAME = 'cw_sess';

function isoPlusDays(days) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, userId, isoPlusDays(SESSION_DAYS));
  return token;
}

export function getSession(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.id, u.name, u.role, u.must_change_pin
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at.replace(' ', 'T') + 'Z') < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    mustChangePin: !!row.must_change_pin,
  };
}

export function destroySession(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function cleanupExpiredSessions() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const r = db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  if (r.changes) console.log(`[session] cleaned ${r.changes} expired session(s)`);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // local + Tailscale, no HTTPS termination
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}
