import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import './db.js';
import { cleanupExpiredSessions } from './session.js';
import authRoutes from './routes/auth.js';

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
