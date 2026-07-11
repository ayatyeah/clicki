import 'dotenv/config';
import os from 'node:os';
import crypto from 'node:crypto';
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
import { saveLead, readLeads, migrateLegacyLeads } from './store.js';
import { readContent, writeContent } from './content.js';
import {
  tiktokEnabled,
  tiktokAuthorizeUrl,
  exchangeTikTokCode,
  refreshTikTokToken,
  fetchTikTokUserInfo,
  fetchTikTokVideoViews,
  parseTikTokVideoId,
} from './tiktok.js';
import {
  initDb,
  saveMedia,
  getMedia,
  getMediaMeta,
  getRates,
  getSettings,
  setSetting,
  listCreators,
  getCreator,
  getCreatorByUsername,
  getCreatorPublicPage,
  getCreatorByToken,
  setCreatorToken,
  setCreatorCredentials,
  createCreator,
  updateCreator,
  listBriefs,
  getBrief,
  creatorCanSubmitToBrief,
  pingDb,
  createBrief,
  setBriefStatus,
  deleteBrief,
  setBriefAi,
  setBriefRevision,
  updateBusinessBrief,
  assignBrief,
  listAssignmentsForCreator,
  createSubmission,
  listSubmissions,
  listCreatorSubmissions,
  getSubmission,
  setSubmissionAi,
  sendSubmissionToBusiness,
  listActiveBriefsRanked,
  setCoachFeedback,
  getViewEstimate,
  getOpsFlags,
  getBusinessReport,
  getAutopilotRecommendations,
  listOpenBriefsForCreator,
  listBusinessSubmissions,
  acceptSubmissionByBusiness,
  reviewSubmission,
  recordViews,
  listDecisionJournal,
  getBusinessGrowth,
  saveOAuthState,
  consumeOAuthState,
  saveTikTokTokens,
  clearTikTokConnection,
  listCreatorsWithTikTok,
  getCreatorWallet,
  getEarningsForecast,
  listPayouts,
  createPayout,
  markPayoutPaid,
  getLeaderboard,
  levelFromXp,
  getAiCache,
  saveAiCache,
  recordVisit,
  getVisitAnalytics,
  recordReferralLead,
  getReferralLeadStats,
  getReferralLeadsForCreator,
  getMonthlyReport,
  createBusiness,
  getBusinessByEmail,
  getBusinessByToken,
  getBusiness,
  updateBusiness,
  setBusinessToken,
  listBusinessBriefs,
  createBusinessBrief,
  listBusinesses,
  setBusinessCredentials,
  deleteBusiness,
  resetPlatformData,
  countLeads,
  touchCreatorSeen,
  touchBusinessSeen,
  getSiteHealth,
  measureDbLatency,
  getPoolStats,
  addStatScreenshot,
  listStatScreenshots,
  getLastScreenshotAt,
  recordRefVisit,
} from './db.js';
import { geminiGenerate, geminiEnabled } from './gemini.js';
import { uploadToSpaces, spacesEnabled } from './storage.js';
import { safeHttpUrl, fetchPageText, buildCspDirectives } from './security.js';
import { maskName, maskContact, maskLeadFields, maskCreatorRow } from './mask.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

// Ephemeral local cache for media blobs. The DB is the source of truth, but we
// read each blob from it at most once, then stream playback from disk so video
// range-requests don't hammer Postgres (managed DBs choke on repeated 90 MB reads).
const MEDIA_CACHE = path.join(os.tmpdir(), 'clicki-media');
mkdirSync(MEDIA_CACHE, { recursive: true });

const app = express();
const PORT = process.env.PORT || 4000;
const IS_PROD = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

// CSP_MODE=report-only ships the policy as Report-Only (the browser logs
// violations but blocks nothing) — use it to smoke-test a change before
// enforcing. CSP_MODE=off disables it entirely. Default is enforce.
const CSP_MODE = process.env.CSP_MODE || 'enforce';
const cspDirectives = buildCspDirectives({
  isProd: IS_PROD,
  mediaHosts: [process.env.SPACES_CDN, process.env.SPACES_ENDPOINT],
});

app.use(
  helmet({
    contentSecurityPolicy:
      CSP_MODE === 'off'
        ? false
        : { useDefaults: false, directives: cspDirectives, reportOnly: CSP_MODE === 'report-only' },
    // The SPA and its media are served from this origin; a same-origin embed is fine.
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
app.use(express.json({ limit: '32kb' }));

// Media is stored in Postgres (not local disk) so it survives redeploys on
// ephemeral-filesystem hosts. Uploads are buffered in memory, then inserted.
//
// SVG is rejected even though it is an `image/*` type: an .svg served from our
// own origin with its real Content-Type executes any <script> inside it, which
// would be stored XSS against the admin session. The same applies to XML-ish
// image types. Everything the CMS actually needs is a raster image or a video.
const ALLOWED_UPLOAD_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/webm',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024, files: 1 }, // 150 MB per file
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_UPLOAD_MIME.has(file.mimetype);
    cb(ok ? null : new Error('Разрешены только JPEG/PNG/WebP/GIF/AVIF и MP4/MOV/WebM'), ok);
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

// In production, refuse to boot with the insecure built-in defaults — they would
// otherwise let anyone log in with admin/admin or the well-known static token.
if (IS_PROD) {
  const insecure = [];
  if (!process.env.ADMIN_PASS || ADMIN_PASS === 'admin') insecure.push('ADMIN_PASS');
  if (!process.env.ADMIN_TOKEN || ADMIN_TOKEN === 'clicki-admin-token') insecure.push('ADMIN_TOKEN');
  if (insecure.length) {
    throw new Error(
      `Refusing to start: set a strong value for ${insecure.join(', ')} in production (the default is publicly known).`,
    );
  }
  // verifyRecaptcha() short-circuits to ok when no secret is configured, so an
  // empty RECAPTCHA_SECRET in production means the lead forms have NO spam
  // protection at all — the fail-closed branch below never even runs. Not fatal
  // (that would take lead capture down), but it must not pass unnoticed.
  if (!process.env.RECAPTCHA_SECRET) {
    console.warn('[startup] WARNING: RECAPTCHA_SECRET is not set — lead forms accept unverified submissions.');
  }
}

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, errors: ['Слишком много попыток входа'] },
});

// Keep AI spend bounded: tight per-IP cap on free-text assistant questions.
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, errors: ['Слишком много вопросов, попробуйте чуть позже'] },
});

// Length-independent constant-time string compare (avoids leaking the token via
// response timing, and avoids timingSafeEqual throwing on length mismatch).
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Admin sessions. Login used to hand back the long-lived ADMIN_TOKEN itself: one
// leak (XSS, a shared screen, a log line) meant permanent admin access with no
// way to revoke short of redeploying with a new secret. Logins now mint a random,
// expiring token held server-side. ADMIN_TOKEN stays valid as a break-glass /
// automation credential, but it is never handed to a browser.
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const adminSessions = new Map(); // token -> expiresAt (ms)

function issueAdminSession() {
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
  return token;
}
function isValidAdminSession(token) {
  const expiresAt = adminSessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}
// Bounded memory: sweep expired sessions hourly rather than growing forever.
setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of adminSessions) if (expiresAt <= now) adminSessions.delete(token);
}, 60 * 60 * 1000).unref();

function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || (!isValidAdminSession(token) && !safeEqual(token, ADMIN_TOKEN))) {
    return res.status(401).json({ ok: false, errors: ['Нет доступа'] });
  }
  next();
}

app.get('/api/health', async (_req, res) => {
  try {
    await pingDb();
    res.json({ ok: true });
  } catch (err) {
    console.error('[health] db unreachable:', err.message);
    res.status(503).json({ ok: false, errors: ['db unavailable'] });
  }
});

// Resolve an "invite a friend" link (clicki-platform.com/friend/<login>) to its owner. Public.
app.get('/api/ref/:login', async (req, res) => {
  try {
    const c = await getCreatorByUsername(req.params.login);
    if (!c) return res.status(404).json({ ok: false, errors: ['Не найдено'] });
    res.json({ ok: true, id: c.id, name: c.name });
  } catch (err) {
    console.error('[ref]', err.message);
    res.status(500).json({ ok: false, errors: ['Ошибка'] });
  }
});

// Public "link in bio" mini-page (clicki-platform.com/<login>): name, socials,
// and the brand CTA links from briefs the creator has completed. Public.
app.get('/api/creator-page/:login', async (req, res) => {
  try {
    const page = await getCreatorPublicPage(req.params.login);
    if (!page) return res.status(404).json({ ok: false, errors: ['Не найдено'] });
    // brandLinks[].url is the business-supplied `req_cta_link`, rendered straight
    // into an <a href> on this public page. Drop anything that isn't http(s) —
    // filtering on read (not just on write) also cleans rows already in the DB.
    const brandLinks = page.brandLinks.map((l) => ({ ...l, url: safeHttpUrl(l.url) })).filter((l) => l.url);
    // Count the click on the creator's ref link (deduped per visitor per day).
    // Best-effort — a bookkeeping failure must not break the public page.
    const dayKey = new Date().toISOString().slice(0, 10);
    const visitor = crypto
      .createHash('sha256')
      .update((req.ip || '') + (req.headers['user-agent'] || '') + dayKey)
      .digest('hex')
      .slice(0, 32);
    recordRefVisit(page.id, visitor).catch((err) => console.error('[ref-visit]', err.message));
    res.json({ ok: true, ...page, brandLinks });
  } catch (err) {
    console.error('[creator-page]', err.message);
    res.status(500).json({ ok: false, errors: ['Ошибка'] });
  }
});

// First-party pageview beacon → visit log (powers the admin analytics page).
const trackLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
app.post('/api/track', trackLimiter, async (req, res) => {
  try {
    const { path: p, referrer, mobile, kind, label } = req.body || {};
    const dayKey = new Date().toISOString().slice(0, 10);
    const visitor = crypto
      .createHash('sha256')
      .update((req.ip || '') + (req.headers['user-agent'] || '') + dayKey)
      .digest('hex')
      .slice(0, 32);
    await recordVisit({
      path: String(p || '/'),
      referrer: typeof referrer === 'string' ? referrer : null,
      visitor,
      is_mobile: !!mobile,
      kind: kind === 'click' ? 'click' : 'page',
      label: typeof label === 'string' ? label : null,
    });
  } catch (err) {
    console.error('[track]', err.message);
  }
  res.json({ ok: true });
});

// Public site content (showcase feed + device screen images).
app.get('/api/content', async (_req, res) => {
  try {
    res.json(await readContent());
  } catch (err) {
    console.error('[content]', err.message);
    res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
  }
});

// On-page assistant: short, cheap AI answer for free-typed questions.
// Hard rule (ТЗ 2.2): never reveal money sums/rates/payouts.
app.post('/api/assistant', assistantLimiter, async (req, res) => {
  const question = String(req.body?.question || '').slice(0, 400).trim();
  const lang = req.body?.lang === 'en' ? 'en' : 'ru';
  if (!question) return res.status(400).json({ ok: false, errors: ['Пустой вопрос'] });

  const fallback =
    lang === 'en'
      ? 'I can’t reach the assistant right now — pick a preset question or leave a request and we’ll reply.'
      : 'Сейчас не получилось получить ответ — выберите готовый вопрос или оставьте заявку, и мы ответим.';

  if (!geminiEnabled) return res.json({ ok: true, answer: fallback });

  const prompt =
    `Ты — дружелюбный помощник сайта CLICKI: performance-платформа органических просмотров и UGC-рекламы с оплатой за результат (Астана). ` +
    `Отвечай ${lang === 'en' ? 'in English' : 'на русском'}, кратко — максимум 2–3 предложения, по делу. ` +
    `СТРОГОЕ ПРАВИЛО: никогда не называй конкретные суммы, ставки, проценты, тарифы или размеры выплат — если спрашивают о цене/заработке, предложи оставить заявку или консультацию. ` +
    `Если вопрос не про CLICKI/UGC/продвижение — мягко верни к теме. ` +
    `Вопрос пользователя: "${question}"`;

  try {
    const answer = await geminiGenerate(prompt, { maxTokens: 160, temperature: 0.4 });
    res.json({ ok: true, answer });
  } catch (err) {
    console.error('[assistant] failed:', err.message);
    res.json({ ok: true, answer: fallback });
  }
});

/** Shared handler for both funnels. */
async function handleLead(funnel, req, res) {
  try {
    // Honeypot: bots fill hidden fields; humans never see them.
    if (req.body?.website) {
      return res.status(200).json({ ok: true }); // silently accept + drop
    }

    const { ok, errors, fields } = validateLead(funnel, req.body);
    if (!ok) return res.status(400).json({ ok: false, errors });

    // Fail-open in dev (no captcha configured locally) but fail-closed in prod so a
    // verification outage can't be used to bypass the spam check.
    const captcha = await verifyRecaptcha(req.body?.recaptchaToken).catch(() => ({ ok: !IS_PROD }));
    if (!captcha.ok) {
      return res.status(400).json({ ok: false, errors: ['Не удалось пройти проверку на спам'] });
    }

    const lead = {
      funnel,
      fields,
      page: typeof req.body?.page === 'string' ? req.body.page.slice(0, 200) : undefined,
      ref: req.body?.ref ? String(req.body.ref).slice(0, 40) : undefined,
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

    // Business lead arrived through a creator's public referral link (bio/profile) →
    // credit that creator with the referral-lead XP bonus. Best-effort, non-blocking.
    if (funnel === 'client' && lead.ref) {
      const creatorId = Number.parseInt(lead.ref, 10);
      if (Number.isInteger(creatorId)) {
        recordReferralLead(creatorId, funnel).catch((err) => console.error('[referral] failed to record lead:', err));
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    // Catches anything unexpected above (e.g. a throw from validateLead) so the
    // request always gets a response instead of hanging forever unanswered.
    console.error('[lead]', err);
    return res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
  }
}

app.post('/api/lead/client', leadLimiter, (req, res) => handleLead('client', req, res));
app.post('/api/lead/creator', leadLimiter, (req, res) => handleLead('creator', req, res));

// Admin login → mints a short-lived session token (never the raw ADMIN_TOKEN).
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (safeEqual(username, ADMIN_USER) && safeEqual(password, ADMIN_PASS)) {
    return res.json({ ok: true, token: issueAdminSession(), expiresIn: ADMIN_SESSION_TTL_MS / 1000 });
  }
  return res.status(401).json({ ok: false, errors: ['Неверный логин или пароль'] });
});

// Explicit logout so a shared/kiosk browser can drop its session immediately
// instead of leaving a valid token alive for the rest of the TTL.
app.post('/api/admin/logout', requireAdmin, (req, res) => {
  adminSessions.delete((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  res.json({ ok: true });
});

// Minimal admin endpoint to review collected leads (Bearer token).
app.get('/api/admin/leads', requireAdmin, async (_req, res) => {
  try {
    const [leads, count] = await Promise.all([readLeads(), countLeads()]);
    res.json({ ok: true, count, leads });
  } catch (err) {
    console.error('[leads]', err.message);
    res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
  }
});

// Upload a media file (image/video) → Spaces if configured (keeps big video out
// of Postgres), otherwise fall back to storing the bytes in the DB.
// Persist an uploaded file → Spaces if configured, otherwise the DB (small
// images only — heavy media pins the managed DB's CPU). Returns a public URL, or
// throws an Error whose message is safe to show the user. Shared by the CMS
// upload and the creator stats-screenshot upload.
async function storeUpload(file, { imageOnly = false } = {}) {
  if (imageOnly && !file.mimetype.startsWith('image/')) {
    throw new Error('Можно загрузить только изображение');
  }
  if (spacesEnabled) {
    return uploadToSpaces(file.buffer, file.mimetype);
  }
  const isVideo = file.mimetype.startsWith('video/');
  if (isVideo || file.size > 4 * 1024 * 1024) {
    throw new Error('Хранилище Spaces не настроено — видео и крупные файлы загружать нельзя. Задайте переменные SPACES_*.');
  }
  const id = await saveMedia(file.mimetype, file.buffer);
  return `/api/media/${id}`;
}

app.post('/api/admin/upload', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, errors: ['Файл не получен'] });
  try {
    res.json({ ok: true, url: await storeUpload(req.file) });
  } catch (err) {
    console.error('[media] failed to save upload:', err);
    res.status(400).json({ ok: false, errors: [err.message || 'Не удалось сохранить файл'] });
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
    // Defence in depth for user-uploaded bytes served from our own origin: the
    // sandbox CSP strips script execution and same-origin privileges from
    // anything navigated to directly, and nosniff stops the browser from
    // second-guessing the declared type. Rows predating the SVG upload ban are
    // covered by this too, so old data can't be used to run script on us.
    res.set('Content-Security-Policy', "sandbox; default-src 'none'");
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'inline');

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
  try {
    const saved = await writeContent(req.body || {});
    res.json({ ok: true, content: saved });
  } catch (err) {
    console.error('[content]', err.message);
    res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
  }
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

// ---- Creator portal (username + password web auth; Telegram login = V2) ----
// Password hashing via scrypt (no extra deps). Stored as "salt:hash" hex.
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const calc = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(calc, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const newToken = () => crypto.randomBytes(24).toString('hex');
// Strip secrets before sending a creator object to the client.
function publicCreator(c) {
  if (!c) return c;
  const { password_hash, session_token, tiktok_access_token, tiktok_refresh_token, tiktok_token_expires_at, tiktok_refresh_expires_at, ...safe } = c;
  return { ...safe, tiktok_connected: !!tiktok_access_token };
}
// Bearer-token middleware — authorizes the caller as a specific creator (no IDOR).
async function requireCreator(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const c = await getCreatorByToken(token);
    if (!c) return res.status(401).json({ ok: false, errors: ['Войдите в кабинет'] });
    req.creator = c;
    // Presence for the admin health page. Fire-and-forget: a failed bookkeeping
    // write must never turn a working request into a 500.
    touchCreatorSeen(c.id).catch((err) => console.error('[presence]', err.message));
    next();
  } catch (err) {
    console.error('[creator-auth]', err);
    res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
  }
}
// Full cabinet payload for the logged-in creator. The six queries are
// independent, so they run concurrently — serially they made every cabinet load
// (and every /api/creator/me poll) pay the sum of six round-trips.
async function creatorPayload(c) {
  const [wallet, forecast, briefs, available, openBriefs, submissions] = await Promise.all([
    getCreatorWallet(c.id),
    getEarningsForecast(c.id),
    listAssignmentsForCreator(c.id),
    listOpenBriefsForCreator(c.id),
    listActiveBriefsRanked(c.id),
    listCreatorSubmissions(c.id),
  ]);
  return { creator: publicCreator(c), level: levelFromXp(c.xp), wallet, forecast, briefs, available, openBriefs, submissions };
}

// Pipeline step 7: AI auto-check on upload. The model scores likely compliance
// with the brief from the supplied metadata and returns short feedback. Cheap
// (small output) and fail-open (never blocks the pipeline if AI is down).
const AI_THRESHOLD = 70;
async function aiCheckSubmission(sub, brief) {
  if (!geminiEnabled) return { score: 80, feedback: 'AI-проверка недоступна — передано менеджеру.' };
  const reqs = [];
  if (brief) {
    if (brief.req_hashtag) reqs.push(`хэштег ${brief.req_hashtag}`);
    if (brief.req_mention) reqs.push('упоминание бренда в первые 3 сек');
    if (brief.req_cta_link) reqs.push('CTA-ссылка');
    reqs.push(`хронометраж ${brief.duration_min}-${brief.duration_max} сек`);
    const spec = brief.spec || {};
    if (spec.orientation) reqs.push(`ориентация ${spec.orientation === 'horizontal' ? 'горизонтальная' : 'вертикальная'}`);
    if (spec.logo_first5) reqs.push('логотип в первые 5 секунд');
    if (spec.brand_spoken) reqs.push('произнести название бренда');
    if (spec.product_in_frame) reqs.push('продукт в кадре');
    if (spec.style) reqs.push(`стиль: ${spec.style}`);
  }
  const prompt =
    `Ты — AI-контроль качества платформы CLICKI. Креатор сдал UGC-видео по брифу. ` +
    `Требования брифа: ${reqs.join('; ') || 'общие'}. Платформа: ${sub.platform}. Ссылка: ${sub.video_url}. ` +
    `Права подтверждены: ${sub.rights_confirmed ? 'да' : 'нет'}. ` +
    `Оцени вероятность соответствия брифу числом 0-100 и дай 1-2 коротких совета. ` +
    `Ответ строго в формате двух строк: SCORE: <число>\nFEEDBACK: <текст по-русски>`;
  try {
    const out = await geminiGenerate(prompt, { maxTokens: 130, temperature: 0.3 });
    const m = out.match(/SCORE:\s*(\d{1,3})/i);
    const score = m ? Math.min(100, Math.max(0, parseInt(m[1], 10))) : 75;
    let feedback = (out.match(/FEEDBACK:\s*([\s\S]*)/i)?.[1] || out).replace(/SCORE:\s*\d+/i, '').trim();
    feedback = (feedback || 'Замечаний нет.').slice(0, 500);
    return { score, feedback };
  } catch (err) {
    console.error('[ai-check]', err.message);
    return { score: 80, feedback: 'AI-проверка временно недоступна — передано менеджеру.' };
  }
}

// AI moderation of a business brief: rates completeness/quality + gives notes so
// the manager can decide to publish to creators or send it back for fixes.
async function aiAnalyzeBrief(brief) {
  if (!geminiEnabled) return { score: 75, feedback: 'AI недоступен — оцените бриф вручную.' };
  const spec = brief.spec || {};
  const desc = [
    `Название: ${brief.title}`,
    `Платформа: ${brief.platform}`,
    brief.key_message ? `Ключевое сообщение: ${brief.key_message}` : '',
    `Ориентация: ${spec.orientation === 'horizontal' ? 'горизонтальная' : 'вертикальная'}`,
    `Макс. длительность: ${brief.duration_max} сек`,
    spec.cta_required ? 'CTA обязателен' : '',
    spec.logo_first5 ? 'Логотип в первые 5 сек' : '',
    spec.brand_spoken ? 'Произнести бренд' : '',
    spec.product_in_frame ? 'Продукт в кадре' : '',
    spec.style ? `Стиль: ${spec.style}` : '',
    brief.req_hashtag ? `Хэштег: ${brief.req_hashtag}` : '',
  ].filter(Boolean).join('; ');
  const prompt =
    `Ты — редактор брифов платформы CLICKI (UGC-реклама). Оцени качество и полноту брифа для съёмки видео креатором ` +
    `от 0 до 100 и дай 2-3 конкретных замечания: что улучшить или чего не хватает. Бриф: ${desc}. ` +
    `Ответ строго двумя строками: SCORE: <число>\nFEEDBACK: <текст по-русски>`;
  try {
    const out = await geminiGenerate(prompt, { maxTokens: 170, temperature: 0.3 });
    const m = out.match(/SCORE:\s*(\d{1,3})/i);
    const score = m ? Math.min(100, Math.max(0, parseInt(m[1], 10))) : 70;
    let feedback = (out.match(/FEEDBACK:\s*([\s\S]*)/i)?.[1] || out).replace(/SCORE:\s*\d+/i, '').trim();
    feedback = (feedback || 'Бриф в целом заполнен, критичных замечаний нет.').slice(0, 600);
    return { score, feedback };
  } catch (err) {
    console.error('[ai-brief]', err.message);
    return { score: 70, feedback: 'AI временно недоступен — оцените вручную.' };
  }
}

// AI Coach: after the operator's final accept/reject decision, generate a short
// personal note on what worked or what to fix next time. Fail-open (never blocks
// the review) and non-fatal if Gemini is unavailable — the decision itself has
// already been saved by the time this runs.
async function aiCoachFeedback(sub, brief, decision) {
  if (!geminiEnabled) return null;
  const REJECT_LABELS = {
    duration: 'не соответствует хронометражу',
    hashtag: 'нет обязательного хэштега',
    mention: 'нет упоминания бренда',
    quality: 'низкое качество съёмки/монтажа',
    rights: 'права на контент не подтверждены',
    off_brief: 'не соответствует брифу',
  };
  const reason = decision.reject_code ? (REJECT_LABELS[decision.reject_code] || decision.reject_code) : null;
  const prompt = decision.status === 'accepted'
    ? `Ты — AI-коуч для блогеров-креаторов платформы CLICKI (UGC-реклама). Видео креатора приняли по брифу ` +
      `«${brief?.title || sub.platform}» на платформе ${sub.platform}, набрано ${sub.views || 0} просмотров. ` +
      `Дай короткую персональную обратную связь: 1) что сработало в этом видео, 2) один конкретный совет, как в следующий раз получить ещё больше просмотров. ` +
      `2-3 предложения, по-русски, дружелюбно, без общих фраз.`
    : `Ты — AI-коуч для блогеров-креаторов платформы CLICKI (UGC-реклама). Видео креатора по брифу ` +
      `«${brief?.title || sub.platform}» отклонили. Причина: ${reason || 'не соответствует требованиям брифа'}. ` +
      `Дай короткую конструктивную обратную связь: без сожалений, объясни в 1 фразе суть проблемы и дай 1-2 конкретных совета, что изменить в следующем видео, чтобы это приняли. ` +
      `2-3 предложения, по-русски, по делу.`;
  try {
    const out = await geminiGenerate(prompt, { maxTokens: 220, temperature: 0.5 });
    return out.trim().slice(0, 500) || null;
  } catch (err) {
    console.error('[ai-coach]', err.message);
    return null;
  }
}

// AI Brief Constructor 2.0: a business gives a URL and/or free-text description
// of what they're promoting, and gets back 3 ready-to-use brief drafts (hook,
// dos/don'ts, tone) plus a 1-100 clarity score for the input itself. JSON mode
// (see gemini.js) because 3 structured drafts don't fit the simple
// SCORE/FEEDBACK line format used elsewhere in this file.
async function aiBriefConstructor({ url, description, platform }) {
  if (!geminiEnabled) return null;
  const pageText = url ? await fetchPageText(url) : null;
  const context = [
    description ? `Описание от бизнеса: ${description}` : '',
    pageText ? `Текст с сайта/страницы: ${pageText}` : (url ? `(ссылка ${url} была недоступна для анализа)` : ''),
  ].filter(Boolean).join('\n');
  if (!context.trim()) return null;
  const prompt =
    `Ты — AI-конструктор брифов для UGC-платформы CLICKI (площадка: ${platform || 'TikTok'}). ` +
    `На основе информации о продукте/бренде составь ровно 3 РАЗНЫХ варианта брифа для креатора-блогера. ` +
    `Также оцени, насколько понятно и полно описан продукт, числом от 0 до 100 (score), и дай 1-2 совета, что стоит уточнить бизнесу (tips). ` +
    `Информация:\n${context}\n\n` +
    `Ответь строго в формате JSON без пояснений: ` +
    `{"score": <число>, "tips": "<текст по-русски>", "drafts": [{"title": "<название>", "hook": "<первая фраза видео, цепляющая с первых секунд>", ` +
    `"key_message": "<ключевое сообщение ролика>", "dos": "<что обязательно сделать, через ;>", "donts": "<чего избегать, через ;>", "tone": "<стиль/тон>"}]} ` +
    `Массив drafts должен содержать ровно 3 элемента. Всё на русском языке.`;
  try {
    const out = await geminiGenerate(prompt, { maxTokens: 1200, temperature: 0.7, json: true });
    const parsed = JSON.parse(out);
    if (!Array.isArray(parsed.drafts) || !parsed.drafts.length) return null;
    return {
      score: Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 0))),
      tips: String(parsed.tips || '').slice(0, 500),
      drafts: parsed.drafts.slice(0, 3).map((d) => ({
        title: String(d.title || '').slice(0, 200),
        hook: String(d.hook || '').slice(0, 300),
        key_message: String(d.key_message || '').slice(0, 400),
        dos: String(d.dos || '').slice(0, 400),
        donts: String(d.donts || '').slice(0, 400),
        tone: String(d.tone || '').slice(0, 120),
      })),
      used_url_text: !!pageText,
    };
  } catch (err) {
    console.error('[ai-brief-constructor]', err.message);
    return null;
  }
}

// Public application to join the platform (ТЗ §3 step 1). Creates a PENDING
// creator with no login — an operator reviews it and issues credentials from the
// admin panel, after which the creator logs in.
app.post(
  '/api/creator/apply',
  leadLimiter,
  wrap(async (req, res) => {
    const { name, contact, socials, city, referred_by } = req.body || {};
    if (!name || !contact) return res.status(400).json({ ok: false, errors: ['Имя и контакт обязательны'] });
    await createCreator({ name, contact, socials, city, referred_by, status: 'pending' });
    notifyOps(`🆕 Заявка креатора: ${name} (${contact})`);
    ok(res, {});
  })
);

app.post(
  '/api/creator/login',
  loginLimiter,
  wrap(async (req, res) => {
    const { username, password } = req.body || {};
    const c = await getCreatorByUsername(username);
    if (!c || !verifyPassword(password, c.password_hash))
      return res.status(401).json({ ok: false, errors: ['Неверный логин или пароль'] });
    const token = newToken();
    await setCreatorToken(c.id, token);
    ok(res, { token, ...(await creatorPayload({ ...c, session_token: token })) });
  })
);

// Current creator (by token).
app.get(
  '/api/creator/me',
  requireCreator,
  wrap(async (req, res) => ok(res, await creatorPayload(req.creator)))
);

// Start the TikTok connect flow (Login Kit): returns the authorize URL to redirect the browser to.
app.post(
  '/api/creator/tiktok/connect',
  requireCreator,
  wrap(async (req, res) => {
    if (!tiktokEnabled) return res.status(400).json({ ok: false, errors: ['Подключение TikTok пока не настроено'] });
    const state = crypto.randomBytes(24).toString('hex');
    await saveOAuthState(state, req.creator.id, 'tiktok');
    ok(res, { url: tiktokAuthorizeUrl(state) });
  })
);
app.post(
  '/api/creator/tiktok/disconnect',
  requireCreator,
  wrap(async (req, res) => {
    await clearTikTokConnection(req.creator.id);
    ok(res, { creator: publicCreator(await getCreator(req.creator.id)) });
  })
);
// A creator checks their own leads/clients brought in via their referral link.
app.get('/api/creator/referrals', requireCreator, wrap(async (req, res) => ok(res, { referrals: await getReferralLeadsForCreator(req.creator.id) })));

// AI Script & Teleprompter: generate a ready-to-read script from the brief's own
// fields so a creator can film straight off the teleprompter instead of guessing
// what to say. Not persisted — cheap enough (small output) to regenerate on demand.
app.post('/api/creator/briefs/:id/script', requireCreator, wrap(async (req, res) => {
  const briefId = Number(req.params.id);
  if (!(await creatorCanSubmitToBrief(req.creator.id, briefId))) {
    return res.status(403).json({ ok: false, errors: ['Бриф недоступен'] });
  }
  const brief = await getBrief(briefId);
  if (!brief) return res.status(404).json({ ok: false, errors: ['Бриф не найден'] });
  if (!geminiEnabled) return res.status(503).json({ ok: false, errors: ['AI временно недоступен'] });
  const spec = brief.spec || {};
  const reqs = [
    `хронометраж ${brief.duration_min}-${brief.duration_max} сек`,
    brief.req_hashtag ? `хэштег ${brief.req_hashtag}` : '',
    spec.brand_spoken ? 'обязательно произнести название бренда' : '',
    spec.logo_first5 ? 'бренд/логотип должен появиться в первые 5 секунд' : '',
    spec.product_in_frame ? 'продукт должен быть в кадре' : '',
    brief.tone ? `стиль: ${brief.tone}` : '',
    brief.dos ? `сделать: ${brief.dos}` : '',
    brief.donts ? `не делать: ${brief.donts}` : '',
  ].filter(Boolean).join('; ');
  const prompt =
    `Ты — сценарист для UGC-блогеров платформы CLICKI. Напиши готовый сценарий для видео по брифу ` +
    `«${brief.title}» на платформе ${brief.platform}. Ключевое сообщение: ${brief.key_message || 'нет'}. Требования: ${reqs || 'общие'}. ` +
    `Раздели сценарий на короткие реплики/кадры (каждая — с новой строки, без нумерации и заголовков), разговорный стиль, ` +
    `естественная речь от первого лица, без markdown-разметки. Уложись в хронометраж.`;
  try {
    const script = await geminiGenerate(prompt, { maxTokens: 500, temperature: 0.7 });
    ok(res, { script: script.trim() });
  } catch (err) {
    console.error('[ai-script]', err.message);
    res.status(503).json({ ok: false, errors: ['AI временно недоступен — попробуйте позже'] });
  }
}));
// TikTok redirects the browser back here after the creator authorizes (or declines). Public.
app.get('/api/auth/tiktok/callback', async (req, res) => {
  const { code, state, error } = req.query || {};
  try {
    if (error || !code || !state) return res.redirect('/creator?tiktok=error');
    const creatorId = await consumeOAuthState(String(state), 'tiktok');
    if (!creatorId) return res.redirect('/creator?tiktok=error');
    const tokens = await exchangeTikTokCode(String(code));
    const userInfo = await fetchTikTokUserInfo(tokens.access_token).catch(() => null);
    await saveTikTokTokens(creatorId, { ...tokens, username: userInfo?.display_name });
    res.redirect('/creator?tiktok=connected');
  } catch (err) {
    console.error('[tiktok-callback]', err.message);
    res.redirect('/creator?tiktok=error');
  }
});

// Onboarding test passed → unlock briefs (ТЗ §3 step 2)
app.post(
  '/api/creator/onboarding',
  requireCreator,
  wrap(async (req, res) => {
    ok(res, { creator: publicCreator(await updateCreator(req.creator.id, { onboarding_passed: true, account_open: true })) });
  })
);

// Creator "My account" — self-service profile: bio, topics (niche picker), city,
// socials. Whitelisted at the DB layer; strings are length-capped here.
app.post(
  '/api/creator/profile',
  requireCreator,
  wrap(async (req, res) => {
    const b = req.body || {};
    const fields = {};
    if (typeof b.bio === 'string') fields.bio = b.bio.slice(0, 500);
    if (typeof b.city === 'string') fields.city = b.city.slice(0, 120);
    if (typeof b.socials === 'string') fields.socials = b.socials.slice(0, 300);
    if (Array.isArray(b.topics)) fields.topics = b.topics.filter((t) => typeof t === 'string').slice(0, 12).join(',');
    else if (typeof b.topics === 'string') fields.topics = b.topics.slice(0, 300);
    ok(res, { creator: publicCreator(await updateCreator(req.creator.id, fields)) });
  })
);

// Creator avatar upload (image only). Reuses storeUpload (Spaces or Postgres blob).
app.post('/api/creator/avatar', requireCreator, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, errors: ['Файл не получен'] });
  try {
    const url = await storeUpload(req.file, { imageOnly: true });
    res.json({ ok: true, creator: publicCreator(await updateCreator(req.creator.id, { avatar_url: url })) });
  } catch (err) {
    console.error('[creator-avatar]', err.message);
    res.status(400).json({ ok: false, errors: [err.message || 'Не удалось сохранить файл'] });
  }
});

// Generic creator image upload → returns a URL. Used to attach a stats screenshot
// at submit time (before the submission row exists), which also confirms the
// creator actually has access to the video's statistics.
app.post('/api/creator/upload', requireCreator, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, errors: ['Файл не получен'] });
  try {
    res.json({ ok: true, url: await storeUpload(req.file, { imageOnly: true }) });
  } catch (err) {
    console.error('[creator-upload]', err.message);
    res.status(400).json({ ok: false, errors: [err.message || 'Не удалось сохранить файл'] });
  }
});

// Take a published order (pipeline step 4): creator self-assigns to an active brief.
app.post(
  '/api/creator/take',
  requireCreator,
  wrap(async (req, res) => {
    const briefId = Number(req.body?.brief_id);
    if (!briefId) return res.status(400).json({ ok: false, errors: ['Не указан заказ'] });
    const brief = await getBrief(briefId);
    if (!brief || brief.status !== 'active') return res.status(400).json({ ok: false, errors: ['Заказ недоступен'] });
    await assignBrief(briefId, req.creator.id);
    ok(res, await creatorPayload(req.creator));
  })
);

// Submit a video (pipeline steps 6-9): create → AI auto-check → ai_passed | rework.
app.post(
  '/api/creator/submit',
  requireCreator,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.platform || !b.video_url || !b.rights_confirmed) {
      return res.status(400).json({ ok: false, errors: ['Укажите видео, платформу и подтвердите права'] });
    }
    // Reject non-http(s) links at the door, so nothing that can execute as script
    // ever reaches the DB and, from there, the operator's review queue.
    const videoUrl = safeHttpUrl(b.video_url);
    if (!videoUrl) return res.status(400).json({ ok: false, errors: ['Ссылка на видео должна быть обычной http(s)-ссылкой'] });
    const screenshotUrl = b.screenshot_url ? safeHttpUrl(b.screenshot_url) : null;
    if (b.screenshot_url && !screenshotUrl) return res.status(400).json({ ok: false, errors: ['Некорректная ссылка на скриншот'] });

    if (b.brief_id && !(await creatorCanSubmitToBrief(req.creator.id, b.brief_id))) {
      return res.status(400).json({ ok: false, errors: ['Этот бриф вам недоступен'] });
    }
    const submission = await createSubmission({ ...b, video_url: videoUrl, screenshot_url: screenshotUrl, creator_id: req.creator.id });
    const brief = b.brief_id ? await getBrief(b.brief_id) : null;
    const { score, feedback } = await aiCheckSubmission(submission, brief);
    const status = score >= AI_THRESHOLD ? 'ai_passed' : 'rework';
    const updated = await setSubmissionAi(submission.id, { ai_score: score, ai_feedback: feedback, status });
    notifyOps(`🎬 Видео от креатора #${req.creator.id}: AI ${score}/100 → ${status === 'ai_passed' ? 'на проверку менеджеру' : 'на доработку'}`);
    ok(res, { submission: updated, ai: { score, feedback, status } });
  })
);

// Daily stats screenshots (гайд): after submitting, the creator uploads a fresh
// TikTok/Instagram stats screenshot every 24h. Stored forever as growth proof.
// Ownership is enforced so a creator can only attach to their OWN submission (no IDOR).
async function creatorOwnsSubmission(creatorId, submissionId) {
  const s = await getSubmission(submissionId);
  return s && s.creator_id === creatorId ? s : null;
}

// Minimum gap between two stats screenshots for the same video. One clean daily
// data point per video → the business gets a coherent growth curve instead of a
// creator dumping five shots in an hour.
const SCREENSHOT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h — one clean data point per day

app.post(
  '/api/creator/submissions/:id/screenshots',
  requireCreator,
  upload.single('file'),
  wrap(async (req, res) => {
    const submissionId = Number(req.params.id);
    if (!(await creatorOwnsSubmission(req.creator.id, submissionId))) {
      return res.status(404).json({ ok: false, errors: ['Видео не найдено'] });
    }
    // Enforce the cooldown before touching the file, so a too-early upload is
    // rejected cheaply. 429 + the wait time so the UI can show a countdown.
    const lastAt = await getLastScreenshotAt(submissionId);
    if (lastAt) {
      const waitMs = SCREENSHOT_COOLDOWN_MS - (Date.now() - lastAt);
      if (waitMs > 0) {
        const hours = Math.floor(waitMs / 3_600_000);
        const mins = Math.ceil((waitMs % 3_600_000) / 60_000);
        return res.status(429).json({
          ok: false,
          retryAfterMs: waitMs,
          errors: [`Следующий скриншот можно загрузить через ${hours ? `${hours} ч ` : ''}${mins} мин — так статистика по дням остаётся ровной.`],
        });
      }
    }
    if (!req.file) return res.status(400).json({ ok: false, errors: ['Файл не получен'] });
    let url;
    try {
      url = await storeUpload(req.file, { imageOnly: true }); // screenshots are images only
    } catch (err) {
      return res.status(400).json({ ok: false, errors: [err.message || 'Не удалось сохранить скриншот'] });
    }
    await addStatScreenshot(submissionId, req.creator.id, url);
    ok(res, { screenshots: await listStatScreenshots(submissionId) });
  })
);

app.get(
  '/api/creator/submissions/:id/screenshots',
  requireCreator,
  wrap(async (req, res) => {
    const submissionId = Number(req.params.id);
    if (!(await creatorOwnsSubmission(req.creator.id, submissionId))) {
      return res.status(404).json({ ok: false, errors: ['Видео не найдено'] });
    }
    ok(res, { screenshots: await listStatScreenshots(submissionId) });
  })
);

// ---- Business (client/brand) self-service cabinet ----
function publicBusiness(b) {
  if (!b) return b;
  const { password_hash, session_token, ...safe } = b;
  return safe;
}
async function requireBusiness(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const b = await getBusinessByToken(token);
    if (!b) return res.status(401).json({ ok: false, errors: ['Войдите в кабинет'] });
    req.business = b;
    touchBusinessSeen(b.id).catch((err) => console.error('[presence]', err.message));
    next();
  } catch (err) {
    console.error('[business-auth]', err);
    res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
  }
}
async function businessPayload(b) {
  const [briefs, submissions] = await Promise.all([listBusinessBriefs(b.id), listBusinessSubmissions(b.id)]);
  return { business: publicBusiness(b), briefs, submissions };
}

// Self-service registration: a brand creates its own account.
app.post(
  '/api/business/register',
  loginLimiter,
  wrap(async (req, res) => {
    const { name, email, company, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ ok: false, errors: ['Имя, email и пароль обязательны'] });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ ok: false, errors: ['Некорректный email'] });
    if (String(password).length < 6) return res.status(400).json({ ok: false, errors: ['Пароль не короче 6 символов'] });
    if (await getBusinessByEmail(email)) return res.status(409).json({ ok: false, errors: ['Аккаунт с таким email уже существует'] });
    const b = await createBusiness({ name: String(name).trim(), email: String(email).trim(), company, password_hash: hashPassword(password) });
    const token = newToken();
    await setBusinessToken(b.id, token);
    notifyOps(`🏢 Новый бизнес-аккаунт: ${name} (${email})`);
    ok(res, { token, ...(await businessPayload({ ...b, session_token: token })) });
  })
);

app.post(
  '/api/business/login',
  loginLimiter,
  wrap(async (req, res) => {
    const { email, password } = req.body || {};
    const b = await getBusinessByEmail(email);
    if (!b || !verifyPassword(password, b.password_hash))
      return res.status(401).json({ ok: false, errors: ['Неверный email или пароль'] });
    const token = newToken();
    await setBusinessToken(b.id, token);
    ok(res, { token, ...(await businessPayload({ ...b, session_token: token })) });
  })
);

app.get('/api/business/me', requireBusiness, wrap(async (req, res) => ok(res, await businessPayload(req.business))));

// Business "My account" — edit company/name; logo has its own multipart endpoint.
app.post('/api/business/profile', requireBusiness, wrap(async (req, res) => {
  const b = req.body || {};
  const fields = {};
  if (typeof b.name === 'string' && b.name.trim()) fields.name = b.name.trim().slice(0, 160);
  if (typeof b.company === 'string') fields.company = b.company.slice(0, 200);
  ok(res, { business: publicBusiness(await updateBusiness(req.business.id, fields)) });
}));

// Business logo upload (image only). Reuses storeUpload (Spaces or Postgres blob).
app.post('/api/business/logo', requireBusiness, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, errors: ['Файл не получен'] });
  try {
    const url = await storeUpload(req.file, { imageOnly: true });
    res.json({ ok: true, business: publicBusiness(await updateBusiness(req.business.id, { logo_url: url })) });
  } catch (err) {
    console.error('[business-logo]', err.message);
    res.status(400).json({ ok: false, errors: [err.message || 'Не удалось сохранить файл'] });
  }
});

// Live growth dashboard: cumulative views across the business's whole campaign, by day.
app.get('/api/business/growth', requireBusiness, wrap(async (req, res) => ok(res, { growth: await getBusinessGrowth(req.business.id) })));

// Printable campaign performance report: views/videos/spend per platform to date.
app.get('/api/business/report', requireBusiness, wrap(async (req, res) => ok(res, await getBusinessReport(req.business.id))));

// Predictive View Calculator: budget -> estimated views/videos per platform, from our own historical yield.
app.get('/api/business/view-calculator', requireBusiness, wrap(async (req, res) => {
  const budget = Number(req.query.budget);
  if (!budget || budget <= 0) return res.status(400).json({ ok: false, errors: ['Укажите бюджет'] });
  const platform = req.query.platform || null;
  ok(res, { estimate: await getViewEstimate(budget, platform) });
}));

// Pipeline step 12-13: business accepts the work → final accept + create payout.
app.post(
  '/api/business/submissions/:id/accept',
  requireBusiness,
  wrap(async (req, res) => {
    // Atomic, conditional transition — a double-click or a re-sent submission
    // can only win this once; a second concurrent/later call gets null back
    // instead of silently creating a second payout for the same video.
    const sub = await acceptSubmissionByBusiness(Number(req.params.id), req.business.id);
    if (!sub) return res.status(400).json({ ok: false, errors: ['Работа не найдена или уже обработана'] });
    // Auto-create a pending payout (manager finalizes it in the payouts view).
    // Respects the same min-views threshold the wallet balance is computed
    // from, so a below-threshold submission can't create a payout the wallet
    // calculation never counted (which would push balance negative).
    try {
      const [rates, settings] = await Promise.all([getRates(), getSettings()]);
      const minViews = settings.min_views_per_video || 2000;
      const rate = rates.find((r) => r.platform === sub.platform)?.creator_rate || 0;
      const amount = (sub.views || 0) >= minViews ? Math.round((sub.views || 0) * rate) : 0;
      if (amount > 0) await createPayout(sub.creator_id, amount, sub.id);
    } catch (err) {
      console.error('[payout]', err.message);
    }
    notifyOps(`✅ Бизнес принял работу #${sub.id}`);
    ok(res, await businessPayload(req.business));
  })
);

// AI Brief Constructor 2.0: URL/description -> 3 brief drafts + input-clarity score.
app.post('/api/business/brief-constructor', requireBusiness, wrap(async (req, res) => {
  const { url, description, platform } = req.body || {};
  if (!url && !description) return res.status(400).json({ ok: false, errors: ['Укажите ссылку или описание'] });
  const result = await aiBriefConstructor({ url, description, platform });
  if (!result) return res.status(503).json({ ok: false, errors: ['AI временно недоступен — попробуйте позже'] });
  ok(res, result);
}));

// Business creates a brief (detailed creative spec). Lands as 'new' for operator review.
app.post(
  '/api/business/briefs',
  requireBusiness,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) return res.status(400).json({ ok: false, errors: ['Название брифа обязательно'] });
    const brief = await createBusinessBrief(req.business.id, b);
    notifyOps(`📋 Новый бриф от бизнеса #${req.business.id}: ${b.title}`);
    ok(res, { brief });
  })
);

// Business edits its own brief (e.g. after it was returned for fixes) → back to moderation.
app.post(
  '/api/business/briefs/:id',
  requireBusiness,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) return res.status(400).json({ ok: false, errors: ['Название обязательно'] });
    const brief = await updateBusinessBrief(Number(req.params.id), req.business.id, b);
    if (!brief) return res.status(404).json({ ok: false, errors: ['Бриф не найден или недоступен'] });
    notifyOps(`✏️ Бизнес #${req.business.id} обновил бриф #${brief.id} — снова на модерации`);
    ok(res, { brief });
  })
);

// ---------------------------------------------------------------------------
// Investor demo (read-only, unauthenticated). The public /demo-admin surface
// shows a trimmed admin: Дашборд, Аналитика, Рефералы, Брифы, Просмотры по
// брифам, Отчёт за месяц, Проверка видео.
//
// These endpoints serve the REAL aggregate numbers, but every piece of personal
// data is masked before it leaves the process. They previously returned raw
// leads — full name, phone and email of every person who ever filled in the
// form — to anyone who requested the URL, with no token. Masking happens here,
// server-side, because the /demo-admin page's own read-only guard is client-side
// JS and does nothing for someone calling the endpoint with curl.
// ---------------------------------------------------------------------------

const demoLead = (l) => ({ ...l, fields: maskLeadFields(l.fields) });
const demoCreator = (c) => {
  const { contact, username, socials, ...safe } = publicCreator(c);
  return { ...safe, name: maskName(safe.name), contact: maskContact(contact), username: username ? maskName(username) : null };
};
// video_url is attacker-controlled free text — never hand a `javascript:` URL to
// an anonymous visitor's browser, even on the demo page.
const demoSubmission = (s) => ({ ...s, creator_name: maskName(s.creator_name), video_url: safeHttpUrl(s.video_url) });

// The demo hits the same aggregate queries as the admin dashboard but has no
// auth in front of it — cap it so an anonymous caller can't hammer Postgres.
const demoLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/demo/', demoLimiter);

app.get('/api/demo/admin/leads', wrap(async (_req, res) => {
  const [leads, count] = await Promise.all([readLeads(200), countLeads()]);
  ok(res, { count, leads: leads.map(demoLead) });
}));
app.get('/api/demo/admin/analytics', wrap(async (_req, res) => ok(res, { analytics: await getVisitAnalytics() })));
app.get('/api/demo/admin/referrals', wrap(async (_req, res) => {
  const referrals = await getReferralLeadStats(); // { total, xpPerLead, byCreator: [...] }
  ok(res, { referrals: { ...referrals, byCreator: referrals.byCreator.map(maskCreatorRow) } });
}));
app.get('/api/demo/admin/briefs', wrap(async (_req, res) => ok(res, { briefs: await listBriefs() })));
app.get('/api/demo/admin/creators', wrap(async (_req, res) => ok(res, { creators: (await listCreators()).map(demoCreator) })));
app.get('/api/demo/admin/submissions', wrap(async (req, res) => ok(res, { submissions: (await listSubmissions(req.query.status)).map(demoSubmission) })));
app.get('/api/demo/admin/reports/monthly', wrap(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;
  const report = await getMonthlyReport(year, month); // { year, month, rows: [...] }
  ok(res, { report: { ...report, rows: report.rows.map(maskCreatorRow) } });
}));

// ---- TikTok auto-sync: pulls real view_count for a creator's videos instead of
// an operator typing it in. Reuses recordViews() so history/XP/anti-fraud all
// still flow through the exact same path as a manual entry would.
async function syncCreatorTikTokViews(creator) {
  let accessToken = creator.tiktok_access_token;
  if (!creator.tiktok_token_expires_at || new Date(creator.tiktok_token_expires_at) <= new Date()) {
    let refreshed;
    try {
      refreshed = await refreshTikTokToken(creator.tiktok_refresh_token);
    } catch (err) {
      // Refresh token revoked/expired — this would otherwise retry forever
      // every 3h with no visible signal. Disconnect so the creator's
      // dashboard shows "not connected" and prompts them to reconnect.
      await clearTikTokConnection(creator.id);
      throw new Error(`TikTok reconnect needed for creator #${creator.id}: ${err.message}`);
    }
    await saveTikTokTokens(creator.id, { ...refreshed, username: creator.tiktok_username });
    accessToken = refreshed.access_token;
  }
  const videos = await fetchTikTokVideoViews(accessToken);
  const viewsById = new Map(videos.map((v) => [String(v.id), v.view_count]));
  const subs = await listCreatorSubmissions(creator.id);
  let updated = 0;
  for (const s of subs) {
    if (s.platform !== 'TikTok' || !['accepted', 'sent_to_business'].includes(s.status)) continue;
    const vid = parseTikTokVideoId(s.video_url);
    if (!vid || !viewsById.has(vid)) continue;
    const views = viewsById.get(vid);
    if (views === s.views) continue; // unchanged — skip the write
    await recordViews(s.id, views, s.views_final);
    updated += 1;
  }
  return updated;
}
async function syncAllTikTokViews() {
  if (!tiktokEnabled) return { synced: 0, creators: 0 };
  const creators = await listCreatorsWithTikTok();
  let synced = 0;
  for (const c of creators) {
    try {
      synced += await syncCreatorTikTokViews(c);
    } catch (err) {
      console.error(`[tiktok-sync] creator #${c.id} failed:`, err.message);
    }
  }
  return { synced, creators: creators.length };
}

// ---- Admin / operator CRM (ТЗ §13) ----

// Site health: one snapshot of accounts, pipeline, money, traffic and the
// runtime itself. Separate from /api/health (the load balancer's liveness probe,
// which must stay cheap and unauthenticated).
app.get('/api/admin/health', requireAdmin, wrap(async (_req, res) => {
  const [snapshot, dbLatencyMs] = await Promise.all([getSiteHealth(), measureDbLatency()]);
  const mem = process.memoryUsage();
  ok(res, {
    ...snapshot,
    system: {
      uptimeSec: Math.round(process.uptime()),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
      rssMb: Math.round(mem.rss / 1048576),
      heapUsedMb: Math.round(mem.heapUsed / 1048576),
      dbLatencyMs: Math.round(dbLatencyMs * 10) / 10,
      pool: getPoolStats(),
      adminSessions: adminSessions.size,
      // Which optional integrations are actually wired up in this deployment —
      // an operator otherwise has no way to tell a disabled feature from a broken one.
      features: {
        gemini: geminiEnabled,
        tiktok: tiktokEnabled,
        spaces: spacesEnabled,
        recaptcha: Boolean(process.env.RECAPTCHA_SECRET),
        telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        email: Boolean(process.env.SMTP_HOST && process.env.MAIL_TO),
        csp: CSP_MODE,
      },
    },
    at: new Date().toISOString(),
  });
}));

app.get('/api/admin/analytics', requireAdmin, wrap(async (_req, res) => ok(res, { analytics: await getVisitAnalytics() })));
// Leads brought in via a creator's public referral link (bio/profile), per creator.
app.get('/api/admin/referrals', requireAdmin, wrap(async (_req, res) => ok(res, { referrals: await getReferralLeadStats() })));
// Monthly leaderboard: leads/clients + views brought in per creator, for a given (or the current) month.
app.get('/api/admin/reports/monthly', requireAdmin, wrap(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;
  ok(res, { report: await getMonthlyReport(year, month) });
}));
// Decision journal: raw accept/reject/rework log — the foundation for future AI, not AI itself.
app.get('/api/admin/decisions', requireAdmin, wrap(async (_req, res) => ok(res, { decisions: await listDecisionJournal() })));
// Manually trigger a TikTok view-count sync across all connected creators.
app.post('/api/admin/tiktok/sync', requireAdmin, wrap(async (_req, res) => ok(res, await syncAllTikTokViews())));
app.get('/api/admin/rates', requireAdmin, wrap(async (_req, res) => ok(res, { rates: await getRates(), settings: await getSettings() })));
// Update a numeric platform setting (e.g. founding_cap — set as high as desired).
app.post('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
  const { key, value } = req.body || {};
  const ALLOWED = [
    'founding_cap', 'min_views_per_video', 'invoice_threshold', 'payout_threshold',
    'fraud_max_views_per_hour', 'fraud_min_smoothness_cv',
    'ops_behind_days', 'ops_fill_ratio', 'ops_churn_days',
  ];
  if (!ALLOWED.includes(key)) return res.status(400).json({ ok: false, errors: ['Недопустимая настройка'] });
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) return res.status(400).json({ ok: false, errors: ['Некорректное значение'] });
  ok(res, { settings: await setSetting(key, v) });
}));
app.get('/api/admin/creators', requireAdmin, wrap(async (_req, res) => ok(res, { creators: (await listCreators()).map(publicCreator) })));
// Operator creates a creator account directly (with login + password).
app.post('/api/admin/creators', requireAdmin, wrap(async (req, res) => {
  const { name, contact, socials, city, username, password } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, errors: ['Имя обязательно'] });
  let hash = null;
  if (username || password) {
    if (!username || String(username).trim().length < 3) return res.status(400).json({ ok: false, errors: ['Логин не короче 3 символов'] });
    if (!password || String(password).length < 6) return res.status(400).json({ ok: false, errors: ['Пароль не короче 6 символов'] });
    if (await getCreatorByUsername(username)) return res.status(409).json({ ok: false, errors: ['Такой логин уже занят'] });
    hash = hashPassword(password);
  }
  const creator = await createCreator({
    name, contact, socials, city,
    username: username ? String(username).trim() : null,
    password_hash: hash,
    status: hash ? 'active' : 'pending',
  });
  ok(res, { creator: publicCreator(creator) });
}));
// ---- Bulk creator registration (operator onboards many creators at once) ----
// Transliterate a name to a latin username base, e.g. "Аружан Ким" -> "aruzhan-kim".
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
function usernameBase(name) {
  const slug = String(name || '')
    .toLowerCase()
    .split('')
    .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  return slug || 'creator';
}
// A short, readable, unambiguous password (no 0/O/1/l/I) — easy to dictate/copy.
function genPassword(len = 8) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
// Pick a username not already taken (in the DB or earlier in this same batch).
async function uniqueUsername(base, taken) {
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (taken.has(candidate) || (await getCreatorByUsername(candidate))) {
    n += 1;
    candidate = `${base}${n}`;
  }
  taken.add(candidate);
  return candidate;
}

app.post('/api/admin/creators/bulk', requireAdmin, wrap(async (req, res) => {
  const rows = Array.isArray(req.body?.creators) ? req.body.creators : [];
  if (!rows.length) return res.status(400).json({ ok: false, errors: ['Список пуст'] });
  if (rows.length > 200) return res.status(400).json({ ok: false, errors: ['За один раз не больше 200 креаторов'] });

  const created = [];
  const errors = [];
  const takenThisBatch = new Set();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const name = String(row.name || '').trim();
    if (!name) { errors.push({ line: i + 1, error: 'Пустое имя' }); continue; }
    try {
      // Use the operator's username if provided (and free), else auto-generate.
      let username = String(row.username || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (username && (takenThisBatch.has(username) || (await getCreatorByUsername(username)))) {
        errors.push({ line: i + 1, name, error: `Логин «${username}» занят` });
        continue;
      }
      if (!username) username = await uniqueUsername(usernameBase(name), takenThisBatch);
      else takenThisBatch.add(username);
      const password = String(row.password || '').trim() || genPassword();
      const creator = await createCreator({
        name,
        contact: row.contact ? String(row.contact).trim() : null,
        socials: row.socials ? String(row.socials).trim() : null,
        city: row.city ? String(row.city).trim() : null,
        username,
        password_hash: hashPassword(password),
        status: 'active',
      });
      // Plaintext password returned ONCE so the operator can hand it to the creator.
      created.push({ id: creator.id, name, username, password, contact: creator.contact || null });
    } catch (err) {
      console.error('[bulk-creator]', err.message);
      errors.push({ line: i + 1, name, error: 'Не удалось создать' });
    }
  }
  notifyOps(`👥 Массовая регистрация: создано ${created.length} креаторов${errors.length ? `, ошибок ${errors.length}` : ''}`);
  ok(res, { created, errors });
}));

// Operator issues / resets login credentials for an existing creator.
app.post('/api/admin/creators/:id/credentials', requireAdmin, wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || String(username).trim().length < 3) return res.status(400).json({ ok: false, errors: ['Логин не короче 3 символов'] });
  if (!password || String(password).length < 6) return res.status(400).json({ ok: false, errors: ['Пароль не короче 6 символов'] });
  const existing = await getCreatorByUsername(username);
  if (existing && existing.id !== Number(req.params.id)) return res.status(409).json({ ok: false, errors: ['Такой логин уже занят'] });
  const creator = await setCreatorCredentials(Number(req.params.id), String(username).trim(), hashPassword(password));
  if (!creator) return res.status(404).json({ ok: false, errors: ['Креатор не найден'] });
  ok(res, { creator: publicCreator(creator) });
}));
app.post('/api/admin/creators/:id', requireAdmin, wrap(async (req, res) => ok(res, { creator: publicCreator(await updateCreator(Number(req.params.id), req.body || {})) })));

/* ---------------- Admin: business accounts ---------------- */
app.get('/api/admin/businesses', requireAdmin, wrap(async (_req, res) => ok(res, { businesses: await listBusinesses() })));
// Operator creates a business account directly (with email + password).
app.post('/api/admin/businesses', requireAdmin, wrap(async (req, res) => {
  const { name, email, company, password } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ ok: false, errors: ['Название обязательно'] });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) return res.status(400).json({ ok: false, errors: ['Некорректный email'] });
  if (!password || String(password).length < 6) return res.status(400).json({ ok: false, errors: ['Пароль не короче 6 символов'] });
  if (await getBusinessByEmail(email)) return res.status(409).json({ ok: false, errors: ['Аккаунт с таким email уже существует'] });
  const b = await createBusiness({ name: String(name).trim(), email: String(email).trim(), company, password_hash: hashPassword(password) });
  ok(res, { business: { id: b.id, name: b.name, email: b.email, company: b.company, created_at: b.created_at, briefs: 0 } });
}));
// Operator resets a business's email/password.
app.post('/api/admin/businesses/:id/credentials', requireAdmin, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) return res.status(400).json({ ok: false, errors: ['Некорректный email'] });
  if (!password || String(password).length < 6) return res.status(400).json({ ok: false, errors: ['Пароль не короче 6 символов'] });
  const existing = await getBusinessByEmail(email);
  if (existing && existing.id !== Number(req.params.id)) return res.status(409).json({ ok: false, errors: ['Такой email уже занят'] });
  const b = await setBusinessCredentials(Number(req.params.id), String(email).trim(), hashPassword(password));
  if (!b) return res.status(404).json({ ok: false, errors: ['Бизнес не найден'] });
  ok(res, { business: b });
}));
// Operator deletes a business account.
app.post('/api/admin/businesses/:id/delete', requireAdmin, wrap(async (req, res) => {
  const done = await deleteBusiness(Number(req.params.id));
  if (!done) return res.status(404).json({ ok: false, errors: ['Бизнес не найден'] });
  ok(res, {});
}));

// Danger zone: wipe all accounts + transactional data for a clean slate.
// Double-guarded: admin-only + an explicit confirm phrase in the body.
app.post('/api/admin/reset-data', requireAdmin, wrap(async (req, res) => {
  if (req.body?.confirm !== 'ОЧИСТИТЬ') return res.status(400).json({ ok: false, errors: ['Подтверждение не совпало'] });
  await resetPlatformData();
  ok(res, {});
}));

app.get('/api/admin/briefs', requireAdmin, wrap(async (_req, res) => ok(res, { briefs: await listBriefs() })));
app.post('/api/admin/briefs', requireAdmin, wrap(async (req, res) => ok(res, { brief: await createBrief(req.body || {}) })));
app.post('/api/admin/briefs/:id/status', requireAdmin, wrap(async (req, res) => ok(res, { brief: await setBriefStatus(Number(req.params.id), req.body?.status) })));
// Delete a brief (e.g. leftover test briefs). Submissions survive (brief_id → NULL).
app.post('/api/admin/briefs/:id/delete', requireAdmin, wrap(async (req, res) => {
  const done = await deleteBrief(Number(req.params.id));
  if (!done) return res.status(404).json({ ok: false, errors: ['Бриф не найден'] });
  ok(res, {});
}));
// AI quality check of a brief (moderation).
app.post('/api/admin/briefs/:id/ai', requireAdmin, wrap(async (req, res) => {
  const brief = await getBrief(Number(req.params.id));
  if (!brief) return res.status(404).json({ ok: false, errors: ['Бриф не найден'] });
  const { score, feedback } = await aiAnalyzeBrief(brief);
  ok(res, { brief: await setBriefAi(brief.id, { ai_score: score, ai_feedback: feedback }) });
}));
// Send a brief back to the business for fixes.
app.post('/api/admin/briefs/:id/revision', requireAdmin, wrap(async (req, res) =>
  ok(res, { brief: await setBriefRevision(Number(req.params.id), String(req.body?.note || '').slice(0, 500)) })
));
app.post('/api/admin/briefs/:id/assign', requireAdmin, wrap(async (req, res) => ok(res, { assignment: await assignBrief(Number(req.params.id), Number(req.body?.creator_id)) })));

app.get('/api/admin/submissions', requireAdmin, wrap(async (req, res) => ok(res, { submissions: await listSubmissions(req.query.status) })));
// CSV export for client/internal reports (ТЗ §13)
app.get(
  '/api/admin/submissions/export',
  requireAdmin,
  wrap(async (_req, res) => {
    const subs = await listSubmissions();
    const head = ['id', 'creator', 'brief', 'platform', 'video_url', 'published_at', 'status', 'reject_code', 'views', 'rights'];
    // Neutralize CSV/formula injection: creator_name and other fields can
    // originate from unauthenticated public form input (/api/creator/apply),
    // and a leading =/+/-/@ is interpreted as a formula by Excel/Sheets on open.
    const esc = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
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
app.post('/api/admin/submissions/:id/review', requireAdmin, wrap(async (req, res) => {
  let submission = await reviewSubmission(Number(req.params.id), req.body || {});
  if (submission && (submission.status === 'accepted' || submission.status === 'rejected')) {
    const brief = submission.brief_id ? await getBrief(submission.brief_id) : null;
    const note = await aiCoachFeedback(submission, brief, { status: submission.status, reject_code: submission.reject_code });
    if (note) submission = await setCoachFeedback(submission.id, note);
  }
  ok(res, { submission });
}));
// Manual retry for AI Coach — the note generation at review time fails silently
// (Gemini down, rate-limited, etc.), so an operator needs a way to re-trigger it
// for an already-decided submission instead of it just staying blank forever.
app.post('/api/admin/submissions/:id/coach', requireAdmin, wrap(async (req, res) => {
  const submission = await getSubmission(Number(req.params.id));
  if (!submission) return res.status(404).json({ ok: false, errors: ['Видео не найдено'] });
  if (submission.status !== 'accepted' && submission.status !== 'rejected') {
    return res.status(400).json({ ok: false, errors: ['Решение по видео ещё не принято'] });
  }
  const brief = submission.brief_id ? await getBrief(submission.brief_id) : null;
  const note = await aiCoachFeedback(submission, brief, { status: submission.status, reject_code: submission.reject_code });
  if (!note) return res.status(503).json({ ok: false, errors: ['AI временно недоступен — попробуйте позже'] });
  ok(res, { submission: await setCoachFeedback(submission.id, note) });
}));
// Pipeline step 10-11: manager approves an AI-passed video and forwards it to the business.
// Guarded (sendSubmissionToBusiness) so an already-accepted/rejected submission can't be re-queued.
app.post('/api/admin/submissions/:id/send-to-business', requireAdmin, wrap(async (req, res) => {
  const submission = await sendSubmissionToBusiness(Number(req.params.id), req.body?.checklist);
  if (!submission) return res.status(400).json({ ok: false, errors: ['Видео уже принято или отклонено'] });
  ok(res, { submission });
}));
app.post('/api/admin/submissions/:id/views', requireAdmin, wrap(async (req, res) => ok(res, { submission: await recordViews(Number(req.params.id), Number(req.body?.views) || 0, !!req.body?.final) })));
// Operator views a submission's daily stats-screenshot series.
app.get('/api/admin/submissions/:id/screenshots', requireAdmin, wrap(async (req, res) => ok(res, { screenshots: await listStatScreenshots(Number(req.params.id)) })));

app.get('/api/admin/payouts', requireAdmin, wrap(async (_req, res) => ok(res, { payouts: await listPayouts() })));
// Manual payout: guarded against the creator's actual unpaid wallet balance —
// unlike the auto-created payout on business accept, nothing here otherwise
// ties the amount to real earned views, so a typo could overpay a creator.
app.post('/api/admin/payouts', requireAdmin, wrap(async (req, res) => {
  const creatorId = Number(req.body?.creator_id);
  const amount = Number(req.body?.amount);
  if (!creatorId || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, errors: ['Укажите креатора и сумму больше нуля'] });
  }
  const wallet = await getCreatorWallet(creatorId);
  if (amount > wallet.balance) {
    return res.status(400).json({ ok: false, errors: [`Сумма превышает баланс креатора (доступно ${Math.round(wallet.balance).toLocaleString('ru-RU')} ₸)`] });
  }
  ok(res, { payout: await createPayout(creatorId, amount) });
}));
app.post('/api/admin/payouts/:id/paid', requireAdmin, wrap(async (req, res) => ok(res, { payout: await markPayoutPaid(Number(req.params.id)) })));

// Ops Copilot: structured, rule-based flags (behind-schedule briefs, at-risk
// creators) — separate from the free-text AI analysis below since these are
// meant to be acted on directly, not read as prose.
app.get('/api/admin/ops-flags', requireAdmin, wrap(async (req, res) => ok(res, await getOpsFlags())));

// Campaign Autopilot: who to assign, what to pause — recommendations only, the
// operator acts via the existing assign/status endpoints below.
app.get('/api/admin/autopilot', requireAdmin, wrap(async (req, res) => ok(res, await getAutopilotRecommendations())));

// AI analysis (Gemini) — cached in DB so we call the API only when data changed
// or the operator forces a refresh (economical).
app.get(
  '/api/admin/ai-analysis',
  requireAdmin,
  wrap(async (req, res) => {
    if (!geminiEnabled) return ok(res, { enabled: false });
    const [leads, leadCount, creators, subs, briefs] = await Promise.all([
      readLeads(),
      countLeads(), // readLeads() is capped; the headline total must not be
      listCreators(),
      listSubmissions(),
      listBriefs(),
    ]);
    const byFunnel = leads.reduce((a, l) => ({ ...a, [l.funnel]: (a[l.funnel] || 0) + 1 }), {});
    const subStatus = subs.reduce((a, s) => ({ ...a, [s.status]: (a[s.status] || 0) + 1 }), {});
    const stats = {
      leads: leadCount,
      leadsByFunnel: byFunnel,
      creators: creators.length,
      onboarded: creators.filter((c) => c.onboarding_passed).length,
      submissions: subs.length,
      subStatus,
      acceptedViews: subs.filter((s) => s.status === 'accepted').reduce((a, s) => a + (s.views || 0), 0),
      briefs: briefs.length,
    };
    const input = JSON.stringify(stats);
    const hash = crypto.createHash('sha1').update(input).digest('hex');
    const TTL = 6 * 60 * 60 * 1000; // 6h cap → a few API calls/day at most
    const refresh = req.query.refresh === '1';
    const cache = await getAiCache();
    const fresh = cache && Date.now() - new Date(cache.created_at).getTime() < TTL;
    // Reuse cache when data is unchanged OR within TTL (unless forced refresh).
    if (cache && !refresh && (cache.input_hash === hash || fresh)) {
      return ok(res, { enabled: true, cached: true, analysis: cache.result, stats, at: cache.created_at });
    }
    const prompt =
      `Ты аналитик платформы CLICKI (реклама с оплатой за органические просмотры через UGC-креаторов). ` +
      `Агрегированные данные:\n${input}\n\n` +
      `Дай краткий анализ состояния (3-4 предложения) и 3-5 конкретных рекомендаций, что делать дальше. ` +
      `Только по-русски, по делу, без воды. Рекомендации — маркированным списком.`;
    const analysis = await geminiGenerate(prompt);
    await saveAiCache(hash, analysis);
    ok(res, { enabled: true, cached: false, analysis, stats, at: new Date().toISOString() });
  })
);

// Upload/multer error handler → JSON instead of HTML. Only messages we author
// (multer's own, and the fileFilter rejection) are echoed back; anything else is
// an unexpected internal error whose message could leak paths or query text.
app.use('/api', (err, _req, res, _next) => {
  const isSafeMessage = err instanceof multer.MulterError || typeof err?.message === 'string' && err.message.startsWith('Разрешены только');
  if (!isSafeMessage) console.error('[api]', err);
  res.status(400).json({ ok: false, errors: [isSafeMessage ? err.message : 'Ошибка запроса'] });
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

// Log (don't silently crash on) anything that slips past the per-request try/catch
// and wrap() helpers — a bare unhandled rejection would otherwise kill the process.
process.on('unhandledRejection', (err) => {
  console.error('[unhandled rejection]', err);
});

// Wait for the DB schema before accepting any traffic — otherwise requests can
// race initDb() on a fresh deploy/restart and fail against missing tables.
// Every route now depends on the DB (leads included), so a failure here is fatal:
// booting anyway would serve a site that 500s on every write and silently drops
// leads. Exiting non-zero lets the platform restart us / hold the old revision.
try {
  await initDb();
  console.log('Database initialized');
  const { migrated, skipped } = await migrateLegacyLeads();
  if (migrated) console.log(`Migrated ${migrated} legacy lead(s) from leads.jsonl into Postgres`);
  else if (skipped === 'table-not-empty') console.log('Legacy leads.jsonl present but leads table is not empty — skipping import');
} catch (err) {
  console.error('Failed to initialize database', err);
  process.exit(1);
}

// Auto-sync TikTok view counts every 3h for every connected creator — the
// automatic version of the operator's manual view entry. No-op if TikTok isn't
// configured (tiktokEnabled is false), and errors per-creator are isolated so
// one broken connection can't block the rest.
if (tiktokEnabled) {
  setInterval(() => {
    syncAllTikTokViews().catch((err) => console.error('[tiktok-sync]', err));
  }, 3 * 60 * 60 * 1000);
}

app.listen(PORT, () => {
  console.log(`CLICKI listening on http://localhost:${PORT}`);
  console.log(`Allowed origins: ${origins.join(', ')}`);
});
