// First import on purpose: this module loads backend/.env as a side effect of
// being evaluated, so the keys are in process.env before anything below runs.
import { envLoaded } from './env.js';

import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';

import { db, DB_PATH } from './db.js';
import { classifyRouter } from './routes/classify.js';
import { describeKeys, isConfigured } from './gemini.js';
import { seedDatabase } from './schema.js';
import { getStats } from './stats.js';
import { ValidationError } from './helpers.js';
import { categoriesRouter } from './routes/categories.js';
import { settingsRouter } from './routes/settings.js';
import { scansRouter } from './routes/scans.js';
import { labelMapRouter } from './routes/labelMap.js';

seedDatabase();

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT) || 4000;

// The frontend is served from a different port in dev, and from a phone over the
// local network / an https tunnel during the demo, so allow any origin.
const io = new SocketServer(httpServer, { cors: { origin: '*' } });
app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (req, res) => {
  // Touch the database so health also proves SQLite is actually working,
  // not just that Express is up.
  const { now } = db.prepare("SELECT datetime('now') AS now").get();
  const { count: categoryCount } = db
    .prepare('SELECT COUNT(*) AS count FROM categories')
    .get();

  res.json({
    status: 'ok',
    service: 'waste-segregation-backend',
    database: 'connected',
    dbPath: DB_PATH,
    categoryCount,
    socketClients: io.engine.clientsCount,
    serverTime: now,
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.use('/api/classify', classifyRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/scans', scansRouter);
app.use('/api/label-map', labelMapRouter);

app.get('/api/stats', (req, res) => {
  const recentLimit = Math.min(Math.max(Number(req.query.recentLimit) || 25, 1), 200);
  res.json(getStats({ recentLimit }));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Central error handler: validation problems become 400s with per-field
// messages, anything else is logged and returned as a generic 500.
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, errors: err.errors });
  }
  console.error('[backend] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

io.on('connection', (socket) => {
  console.log(`[socket] client connected (${io.engine.clientsCount} total)`);

  // Send a snapshot immediately so a dashboard opened mid-demo is populated
  // before the next scan arrives.
  socket.emit('stats', getStats());

  socket.on('disconnect', () => {
    console.log(`[socket] client disconnected (${io.engine.clientsCount} remaining)`);
  });
});

// Listen on 0.0.0.0 so a phone on the same Wi-Fi can reach this machine.
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
  console.log(`[backend] health check: http://localhost:${PORT}/api/health`);
  console.log(`[backend] socket.io ready`);
  console.log(`[backend] database: ${DB_PATH}`);
  console.log(`[backend] .env ${envLoaded ? 'loaded' : 'NOT FOUND'}`);

  const keys = describeKeys();
  if (isConfigured()) {
    console.log(
      `[gemini] ${keys.length} key(s): ${keys.map((k) => k.hint).join(', ')} ` +
        `(~${keys.length * 1500} scans/day)`
    );
    const wrongFormat = keys.filter((k) => !k.looksLikeAiStudioKey);
    if (wrongFormat.length) {
      console.warn(
        `[gemini] WARNING: ${wrongFormat.length} key(s) do not start with "AIza". ` +
          'Google AI Studio keys look like AIzaSy... — a key from the Cloud Console ' +
          'will be rejected with ACCESS_TOKEN_TYPE_UNSUPPORTED.'
      );
    }
  } else {
    console.warn('[gemini] NO API KEY — add GEMINI_API_KEY to backend/.env');
  }
});
