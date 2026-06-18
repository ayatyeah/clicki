import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { validateLead } from './validate.js';
import { verifyRecaptcha } from './recaptcha.js';
import { dispatchLead } from './notify.js';
import { saveLead, readLeads } from './store.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '32kb' }));

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

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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

// Minimal admin endpoint to review collected leads (Bearer token).
app.get('/api/admin/leads', async (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  const auth = req.headers.authorization || '';
  if (!token || auth !== `Bearer ${token}`) {
    return res.status(401).json({ ok: false, errors: ['Нет доступа'] });
  }
  const leads = await readLeads();
  res.json({ ok: true, count: leads.length, leads });
});

app.listen(PORT, () => {
  console.log(`CLICKI API listening on http://localhost:${PORT}`);
  console.log(`Allowed origins: ${origins.join(', ')}`);
});
