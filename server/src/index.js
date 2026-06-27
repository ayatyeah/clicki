import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, createReadStream, statSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';

import { validateLead } from './validate.js';
import { verifyRecaptcha } from './recaptcha.js';
import { dispatchLead, notifyOps } from './notify.js';
import { saveLead, readLeads } from './store.js';
import { readContent, writeContent } from './content.js';
import {
  initDb,
  saveMedia,
  getMedia,
  getMediaMeta,
  getRates,
  getSettings,
  listCreators,
  getCreator,
  createCreator,
  updateCreator,
  listBriefs,
  createBrief,
  setBriefStatus,
  assignBrief,
  listAssignmentsForCreator,
  createSubmission,
  listSubmissions,
  listCreatorSubmissions,
  reviewSubmission,
  recordViews,
  getCreatorWallet,
  listPayouts,
  createPayout,
  markPayoutPaid,
  getLeaderboard,
  levelFromXp,
} from './db.js';
import { uploadToSpaces, spacesEnabled } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

// Ephemeral local cache for media blobs. The DB is the source of truth, but we
// read each blob from it at most once, then stream playback from disk so video
// range-requests don't hammer Postgres (managed DBs choke on repeated 90 MB reads).
const MEDIA_CACHE = path.join(os.tmpdir(), 'clicki-media');
mkdirSync(MEDIA_CACHE, { recursive: true });

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);
// CSP disabled: this server also serves the SPA, which loads external
// fonts/analytics; a strict default CSP would block them.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '32kb' }));

// Media is stored in Postgres (not local disk) so it survives redeploys on
// ephemeral-filesystem hosts. Uploads are buffered in memory, then inserted.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB per file
  fileFilter: (_req, file, cb) => {
    const ok = /^(image|video)\//.test(file.mimetype);
    cb(ok ? null : new Error('Только изображения и видео'), ok);
  },
});

const origins = (process.env.CORS_ORIGINS || 'http://localhost:5174')
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

// Upload a media file (image/video) → Spaces if configured (keeps big video out
// of Postgres), otherwise fall back to storing the bytes in the DB.
app.post('/api/admin/upload', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, errors: ['Файл не получен'] });
  try {
    if (spacesEnabled) {
      const url = await uploadToSpaces(req.file.buffer, req.file.mimetype);
      return res.json({ ok: true, url });
    }
    // No object storage configured: never let heavy media into Postgres (it
    // pins the DB CPU). Only small images may fall back to DB storage.
    const isVideo = req.file.mimetype.startsWith('video/');
    if (isVideo || req.file.size > 4 * 1024 * 1024) {
      return res.status(400).json({
        ok: false,
        errors: ['Хранилище Spaces не настроено — видео и крупные файлы загружать нельзя. Задайте переменные SPACES_*.'],
      });
    }
    const id = await saveMedia(req.file.mimetype, req.file.buffer);
    res.json({ ok: true, url: `/api/media/${id}` });
  } catch (err) {
    console.error('[media] failed to save upload:', err);
    res.status(500).json({ ok: false, errors: ['Не удалось сохранить файл'] });
  }
});

// Serve a media file (public). The bytes live in Postgres, but we cache each
// blob on local disk on first access and stream from there — so video range
// requests during playback hit the disk, not the DB. Supports HTTP Range, which
// browsers require to play <video> (otherwise playback silently fails).
app.get('/api/media/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).end();
  try {
    // Cheap query — does NOT read the big `data` column.
    const meta = await getMediaMeta(id);
    if (!meta) return res.status(404).end();

    const file = path.join(MEDIA_CACHE, String(id));
    if (!existsSync(file)) {
      const full = await getMedia(id); // one-time blob read, then cached to disk
      if (!full) return res.status(404).end();
      await writeFile(file, full.data);
    }

    const total = statSync(file).size;
    res.set('Content-Type', meta.mime);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=604800, immutable');

    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      let start = match && match[1] ? Number.parseInt(match[1], 10) : 0;
      let end = match && match[2] ? Number.parseInt(match[2], 10) : total - 1;
      if (!Number.isInteger(start) || start < 0) start = 0;
      if (!Number.isInteger(end) || end >= total) end = total - 1;
      if (start > end) {
        return res.status(416).set('Content-Range', `bytes */${total}`).end();
      }
      res.status(206);
      res.set('Content-Range', `bytes ${start}-${end}/${total}`);
      res.set('Content-Length', String(end - start + 1));
      return createReadStream(file, { start, end }).pipe(res);
    }

    res.set('Content-Length', String(total));
    createReadStream(file).pipe(res);
  } catch (err) {
    console.error('[media] failed to read media:', err);
    res.status(500).end();
  }
});

// Save site content (showcase feed + device screen images).
app.post('/api/admin/content', requireAdmin, async (req, res) => {
  const saved = await writeContent(req.body || {});
  res.json({ ok: true, content: saved });
});

/* =========================================================================
   PLATFORM API (ТЗ) — creators, briefs, submissions, review, wallet, payouts
   ========================================================================= */
const ok = (res, data) => res.json({ ok: true, ...data });
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error('[platform]', err);
    res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
  }
};

// Public rates/thresholds (ТЗ §2)
app.get('/api/rates', wrap(async (_req, res) => ok(res, { rates: await getRates(), settings: await getSettings() })));
// Public leaderboard (ТЗ §4.2)
app.get('/api/leaderboard', wrap(async (_req, res) => ok(res, { leaderboard: await getLeaderboard() })));

// ---- Creator portal (lightweight web auth: id kept client-side; Telegram = V2) ----
app.post(
  '/api/creator/register',
  leadLimiter,
  wrap(async (req, res) => {
    const { name, contact, socials, city, referred_by } = req.body || {};
    if (!name || !contact) return res.status(400).json({ ok: false, errors: ['Имя и контакт обязательны'] });
    const creator = await createCreator({ name, contact, socials, city, referred_by });
    notifyOps(`🆕 Новый креатор: ${name} (${contact})`);
    ok(res, { creator });
  })
);
app.get(
  '/api/creator/:id',
  wrap(async (req, res) => {
    const c = await getCreator(Number(req.params.id));
    if (!c) return res.status(404).json({ ok: false, errors: ['Креатор не найден'] });
    ok(res, {
      creator: c,
      level: levelFromXp(c.xp),
      wallet: await getCreatorWallet(c.id),
      briefs: await listAssignmentsForCreator(c.id),
      submissions: await listCreatorSubmissions(c.id),
    });
  })
);
// Onboarding test passed → unlock briefs (ТЗ §3 step 2)
app.post(
  '/api/creator/:id/onboarding',
  wrap(async (req, res) => {
    ok(res, { creator: await updateCreator(Number(req.params.id), { onboarding_passed: true, account_open: true }) });
  })
);
// Submit a video (ТЗ §3 step 4)
app.post(
  '/api/creator/:id/submit',
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.platform || !b.video_url || !b.rights_confirmed) {
      return res.status(400).json({ ok: false, errors: ['Укажите видео, платформу и подтвердите права'] });
    }
    const submission = await createSubmission({ ...b, creator_id: Number(req.params.id) });
    notifyOps(`🎬 Новое видео на проверку (${b.platform}) от креатора #${req.params.id}`);
    ok(res, { submission });
  })
);

// ---- Admin / operator CRM (ТЗ §13) ----
app.get('/api/admin/rates', requireAdmin, wrap(async (_req, res) => ok(res, { rates: await getRates(), settings: await getSettings() })));
app.get('/api/admin/creators', requireAdmin, wrap(async (_req, res) => ok(res, { creators: await listCreators() })));
app.post('/api/admin/creators/:id', requireAdmin, wrap(async (req, res) => ok(res, { creator: await updateCreator(Number(req.params.id), req.body || {}) })));

app.get('/api/admin/briefs', requireAdmin, wrap(async (_req, res) => ok(res, { briefs: await listBriefs() })));
app.post('/api/admin/briefs', requireAdmin, wrap(async (req, res) => ok(res, { brief: await createBrief(req.body || {}) })));
app.post('/api/admin/briefs/:id/status', requireAdmin, wrap(async (req, res) => ok(res, { brief: await setBriefStatus(Number(req.params.id), req.body?.status) })));
app.post('/api/admin/briefs/:id/assign', requireAdmin, wrap(async (req, res) => ok(res, { assignment: await assignBrief(Number(req.params.id), Number(req.body?.creator_id)) })));

app.get('/api/admin/submissions', requireAdmin, wrap(async (req, res) => ok(res, { submissions: await listSubmissions(req.query.status) })));
// CSV export for client/internal reports (ТЗ §13)
app.get(
  '/api/admin/submissions/export',
  requireAdmin,
  wrap(async (_req, res) => {
    const subs = await listSubmissions();
    const head = ['id', 'creator', 'brief', 'platform', 'video_url', 'published_at', 'status', 'reject_code', 'views', 'rights'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = subs.map((s) =>
      [s.id, s.creator_name, s.brief_title, s.platform, s.video_url, s.published_at, s.status, s.reject_code, s.views, s.rights_confirmed]
        .map(esc)
        .join(',')
    );
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="submissions.csv"');
    res.send('﻿' + [head.join(','), ...rows].join('\n'));
  })
);
app.post('/api/admin/submissions/:id/review', requireAdmin, wrap(async (req, res) => ok(res, { submission: await reviewSubmission(Number(req.params.id), req.body || {}) })));
app.post('/api/admin/submissions/:id/views', requireAdmin, wrap(async (req, res) => ok(res, { submission: await recordViews(Number(req.params.id), Number(req.body?.views) || 0, !!req.body?.final) })));

app.get('/api/admin/payouts', requireAdmin, wrap(async (_req, res) => ok(res, { payouts: await listPayouts() })));
app.post('/api/admin/payouts', requireAdmin, wrap(async (req, res) => ok(res, { payout: await createPayout(Number(req.body?.creator_id), Number(req.body?.amount)) })));
app.post('/api/admin/payouts/:id/paid', requireAdmin, wrap(async (req, res) => ok(res, { payout: await markPayoutPaid(Number(req.params.id)) })));

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
