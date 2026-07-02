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
import { saveLead, readLeads } from './store.js';
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
  createBrief,
  setBriefStatus,
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
  setSubmissionStatus,
  listActiveBriefs,
  listOpenBriefsForCreator,
  listBusinessSubmissions,
  getSubmissionBusiness,
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
  createBusiness,
  getBusinessByEmail,
  getBusinessByToken,
  setBusinessToken,
  listBusinessBriefs,
  createBusinessBrief,
} from './db.js';
import { geminiGenerate, geminiEnabled } from './gemini.js';
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
const IS_PROD = process.env.NODE_ENV === 'production';
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

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!safeEqual(auth, `Bearer ${ADMIN_TOKEN}`)) {
    return res.status(401).json({ ok: false, errors: ['Нет доступа'] });
  }
  next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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
    res.json({ ok: true, ...page });
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
  res.json(await readContent());
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
}

app.post('/api/lead/client', leadLimiter, (req, res) => handleLead('client', req, res));
app.post('/api/lead/creator', leadLimiter, (req, res) => handleLead('creator', req, res));

// Admin login → returns a bearer token used for the admin API.
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (safeEqual(username, ADMIN_USER) && safeEqual(password, ADMIN_PASS)) {
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
    next();
  } catch (err) {
    console.error('[creator-auth]', err);
    res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
  }
}
// Full cabinet payload for the logged-in creator.
async function creatorPayload(c) {
  return {
    creator: publicCreator(c),
    level: levelFromXp(c.xp),
    wallet: await getCreatorWallet(c.id),
    briefs: await listAssignmentsForCreator(c.id),
    available: await listOpenBriefsForCreator(c.id),
    openBriefs: await listActiveBriefs(),
    submissions: await listCreatorSubmissions(c.id),
  };
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
    const submission = await createSubmission({ ...b, creator_id: req.creator.id });
    const brief = b.brief_id ? await getBrief(b.brief_id) : null;
    const { score, feedback } = await aiCheckSubmission(submission, brief);
    const status = score >= AI_THRESHOLD ? 'ai_passed' : 'rework';
    const updated = await setSubmissionAi(submission.id, { ai_score: score, ai_feedback: feedback, status });
    notifyOps(`🎬 Видео от креатора #${req.creator.id}: AI ${score}/100 → ${status === 'ai_passed' ? 'на проверку менеджеру' : 'на доработку'}`);
    ok(res, { submission: updated, ai: { score, feedback, status } });
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
    next();
  } catch (err) {
    console.error('[business-auth]', err);
    res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
  }
}
async function businessPayload(b) {
  return {
    business: publicBusiness(b),
    briefs: await listBusinessBriefs(b.id),
    submissions: await listBusinessSubmissions(b.id),
  };
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

// Live growth dashboard: cumulative views across the business's whole campaign, by day.
app.get('/api/business/growth', requireBusiness, wrap(async (req, res) => ok(res, { growth: await getBusinessGrowth(req.business.id) })));

// Pipeline step 12-13: business accepts the work → final accept + create payout.
app.post(
  '/api/business/submissions/:id/accept',
  requireBusiness,
  wrap(async (req, res) => {
    const sub = await getSubmissionBusiness(Number(req.params.id));
    if (!sub || sub.business_id !== req.business.id) return res.status(404).json({ ok: false, errors: ['Не найдено'] });
    if (sub.status !== 'sent_to_business') return res.status(400).json({ ok: false, errors: ['Работа не на приёмке'] });
    await reviewSubmission(sub.id, { status: 'accepted' });
    // Auto-create a pending payout (manager finalizes it in the payouts view).
    try {
      const rates = await getRates();
      const rate = rates.find((r) => r.platform === sub.platform)?.creator_rate || 0;
      const amount = Math.round((sub.views || 0) * rate);
      if (amount > 0) await createPayout(sub.creator_id, amount);
    } catch (err) {
      console.error('[payout]', err.message);
    }
    notifyOps(`✅ Бизнес принял работу #${sub.id}`);
    ok(res, await businessPayload(req.business));
  })
);

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

// ---- TikTok auto-sync: pulls real view_count for a creator's videos instead of
// an operator typing it in. Reuses recordViews() so history/XP/anti-fraud all
// still flow through the exact same path as a manual entry would.
async function syncCreatorTikTokViews(creator) {
  let accessToken = creator.tiktok_access_token;
  if (!creator.tiktok_token_expires_at || new Date(creator.tiktok_token_expires_at) <= new Date()) {
    const refreshed = await refreshTikTokToken(creator.tiktok_refresh_token);
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
app.get('/api/admin/analytics', requireAdmin, wrap(async (_req, res) => ok(res, { analytics: await getVisitAnalytics() })));
// Leads brought in via a creator's public referral link (bio/profile), per creator.
app.get('/api/admin/referrals', requireAdmin, wrap(async (_req, res) => ok(res, { referrals: await getReferralLeadStats() })));
// Decision journal: raw accept/reject/rework log — the foundation for future AI, not AI itself.
app.get('/api/admin/decisions', requireAdmin, wrap(async (_req, res) => ok(res, { decisions: await listDecisionJournal() })));
// Manually trigger a TikTok view-count sync across all connected creators.
app.post('/api/admin/tiktok/sync', requireAdmin, wrap(async (_req, res) => ok(res, await syncAllTikTokViews())));
app.get('/api/admin/rates', requireAdmin, wrap(async (_req, res) => ok(res, { rates: await getRates(), settings: await getSettings() })));
// Update a numeric platform setting (e.g. founding_cap — set as high as desired).
app.post('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
  const { key, value } = req.body || {};
  const ALLOWED = ['founding_cap', 'min_views_per_video', 'invoice_threshold', 'payout_threshold', 'fraud_max_views_per_hour', 'fraud_min_smoothness_cv'];
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

app.get('/api/admin/briefs', requireAdmin, wrap(async (_req, res) => ok(res, { briefs: await listBriefs() })));
app.post('/api/admin/briefs', requireAdmin, wrap(async (req, res) => ok(res, { brief: await createBrief(req.body || {}) })));
app.post('/api/admin/briefs/:id/status', requireAdmin, wrap(async (req, res) => ok(res, { brief: await setBriefStatus(Number(req.params.id), req.body?.status) })));
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
// Pipeline step 10-11: manager approves an AI-passed video and forwards it to the business.
app.post('/api/admin/submissions/:id/send-to-business', requireAdmin, wrap(async (req, res) => ok(res, { submission: await setSubmissionStatus(Number(req.params.id), 'sent_to_business') })));
app.post('/api/admin/submissions/:id/views', requireAdmin, wrap(async (req, res) => ok(res, { submission: await recordViews(Number(req.params.id), Number(req.body?.views) || 0, !!req.body?.final) })));

app.get('/api/admin/payouts', requireAdmin, wrap(async (_req, res) => ok(res, { payouts: await listPayouts() })));
app.post('/api/admin/payouts', requireAdmin, wrap(async (req, res) => ok(res, { payout: await createPayout(Number(req.body?.creator_id), Number(req.body?.amount)) })));
app.post('/api/admin/payouts/:id/paid', requireAdmin, wrap(async (req, res) => ok(res, { payout: await markPayoutPaid(Number(req.params.id)) })));

// AI analysis (Gemini) — cached in DB so we call the API only when data changed
// or the operator forces a refresh (economical).
app.get(
  '/api/admin/ai-analysis',
  requireAdmin,
  wrap(async (req, res) => {
    if (!geminiEnabled) return ok(res, { enabled: false });
    const [leads, creators, subs, briefs] = [await readLeads(), await listCreators(), await listSubmissions(), await listBriefs()];
    const byFunnel = leads.reduce((a, l) => ({ ...a, [l.funnel]: (a[l.funnel] || 0) + 1 }), {});
    const subStatus = subs.reduce((a, s) => ({ ...a, [s.status]: (a[s.status] || 0) + 1 }), {});
    const stats = {
      leads: leads.length,
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

// Log (don't silently crash on) anything that slips past the per-request try/catch
// and wrap() helpers — a bare unhandled rejection would otherwise kill the process.
process.on('unhandledRejection', (err) => {
  console.error('[unhandled rejection]', err);
});

// Wait for the DB schema before accepting any traffic — otherwise requests can
// race initDb() on a fresh deploy/restart and fail against missing tables.
try {
  await initDb();
  console.log('Database initialized');
} catch (err) {
  console.error('Failed to initialize database', err);
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
