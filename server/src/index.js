import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';

import { validateLead } from './validate.js';
import { verifyRecaptcha } from './recaptcha.js';
import { dispatchLead } from './notify.js';
import { saveLead, readLeads } from './store.js';
import { readContent, writeContent } from './content.js';
import { initDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
const UPLOADS = path.join(__dirname, '..', 'uploads');
mkdirSync(UPLOADS, { recursive: true });

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);
// CSP disabled: this server also serves the SPA, which loads external
// fonts/analytics; a strict default CSP would block them.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '32kb' }));

// Uploaded media (showcase videos, device screen images).
app.use('/uploads', express.static(UPLOADS, { maxAge: '7d' }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12).replace(/[^.\w]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 }, // 80 MB
  fileFilter: (_req, file, cb) => {
    const ok = /^(image|video)\//.test(file.mimetype);
    cb(ok ? null : new Error('Только изображения и видео'), ok);
  },
});

const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins }));

const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, errors: ['Слишком много запросов, попробуйте позже'] },
});

// ---- Admin auth ----
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'clicki-admin-token';
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, errors: ['Слишком много попыток входа'] },
});

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ ok: false, errors: ['Нет доступа'] });
  }
  next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Public site content (showcase feed + device screen images).
app.get('/api/content', async (_req, res) => {
  res.json(await readContent());
});

/** Shared handler for both funnels. */
async function handleLead(funnel, req, res) {
  // Honeypot: bots fill hidden fields; humans never see them.
  if (req.body?.website) {
    return res.status(200).json({ ok: true }); // silently accept + drop
  }

  const { ok, errors, fields } = validateLead(funnel, req.body);
  if (!ok) return res.status(400).json({ ok: false, errors });

  const captcha = await verifyRecaptcha(req.body?.recaptchaToken).catch(() => ({ ok: true }));
  if (!captcha.ok) {
    return res.status(400).json({ ok: false, errors: ['Не удалось пройти проверку на спам'] });
  }

  const lead = {
    funnel,
    fields,
    page: typeof req.body?.page === 'string' ? req.body.page.slice(0, 200) : undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    await saveLead(lead);
  } catch (err) {
    console.error('[store] failed to save lead:', err);
    return res.status(500).json({ ok: false, errors: ['Внутренняя ошибка, попробуйте позже'] });
  }

  // Notifications are best-effort: don't block the success response on them.
  dispatchLead(lead).catch((err) => console.error('[notify] dispatch failed:', err));

  return res.json({ ok: true });
}

app.post('/api/lead/client', leadLimiter, (req, res) => handleLead('client', req, res));
app.post('/api/lead/creator', leadLimiter, (req, res) => handleLead('creator', req, res));

// Admin login → returns a bearer token used for the admin API.
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ ok: true, token: ADMIN_TOKEN });
  }
  return res.status(401).json({ ok: false, errors: ['Неверный логин или пароль'] });
});

// Minimal admin endpoint to review collected leads (Bearer token).
app.get('/api/admin/leads', requireAdmin, async (_req, res) => {
  const leads = await readLeads();
  res.json({ ok: true, count: leads.length, leads });
});

// Upload a media file (image/video) → returns its public URL.
app.post('/api/admin/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, errors: ['Файл не получен'] });
  res.json({ ok: true, url: `/uploads/${req.file.filename}` });
});

// Save site content (showcase feed + device screen images).
app.post('/api/admin/content', requireAdmin, async (req, res) => {
  const saved = await writeContent(req.body || {});
  res.json({ ok: true, content: saved });
});

// Upload/multer error handler → JSON instead of HTML.
app.use('/api', (err, _req, res, _next) => {
  res.status(400).json({ ok: false, errors: [err?.message || 'Ошибка запроса'] });
});

// ---- Serve the built React app (single-service deploy) ----
// When client/dist exists (production build), serve it + SPA fallback so
// /business, /creators, etc. resolve to index.html on refresh.
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
  console.log(`Serving static client from ${CLIENT_DIST}`);
} else {
  console.log('client/dist not found — running API only (dev mode uses Vite separately)');
}

app.listen(PORT, async () => {
  try {
    await initDb();
    console.log('Database initialized');
  } catch (err) {
    console.error('Failed to initialize database', err);
  }
  console.log(`CLICKI listening on http://localhost:${PORT}`);
  console.log(`Allowed origins: ${origins.join(', ')}`);
});
