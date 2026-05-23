import { getSession, COOKIE_NAME } from '../session.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const user = getSession(token);
  if (!user) return res.status(401).json({ error: 'not authenticated' });
  req.user = user;
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

// Many actions are blocked until the user has set a real PIN.
export function requirePinChanged(req, res, next) {
  if (req.user?.mustChangePin) {
    return res.status(403).json({ error: 'pin_change_required' });
  }
  next();
}
