import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import './db.js';
import { cleanupExpiredSessions } from './session.js';
import { requireAuth } from './middleware/auth.js';
import { RECEIPTS_DIR } from './lib/uploads.js';
import authRoutes from './routes/auth.js';
import ratesRoutes from './routes/rates.js';
import transactionsRoutes from './routes/transactions.js';
import momRoutes from './routes/mom.js';
import approvalsRoutes from './routes/approvals.js';
import budgetsRoutes from './routes/budgets.js';
import goalsRoutes from './routes/goals.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import pendingDesiresRoutes from './routes/pending-desires.js';
import reportsRoutes from './routes/reports.js';
import reviewsRoutes from './routes/reviews.js';
import incomeRoutes from './routes/income.js';
import cashRoutes from './routes/cash.js';
import setupRoutes from './routes/setup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const IS_PROD = process.env.NODE_ENV === 'production';

cleanupExpiredSessions();

const app = express();

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// CORS only matters in dev when Vite (5173) calls Express (4000).
// In prod the server serves the client and there is no cross-origin.
if (!IS_PROD) {
  app.use(
    cors({
      origin: (origin, cb) => cb(null, true), // any LAN/Tailscale origin in dev
      credentials: true,
    })
  );
}

app.use('/api/auth', authRoutes);
app.use('/api/rates', ratesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/mom', momRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/pending-desires', pendingDesiresRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/setup', setupRoutes);

// Receipts behind auth — the path is predictable enough that we don't want
// it scrape-able. Same-origin in prod, dev proxies /receipts through Vite.
app.use('/receipts', requireAuth, express.static(RECEIPTS_DIR, {
  fallthrough: false,
  maxAge: 0,
}));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Serve built client in production.
const CLIENT_DIST = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (IS_PROD && fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, req, res, _next) => {
  console.error('[err]', err);
  res.status(500).json({ error: 'internal' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${PORT} (${IS_PROD ? 'prod' : 'dev'})`);
});
