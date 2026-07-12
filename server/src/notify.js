import nodemailer from 'nodemailer';

const FUNNEL_LABELS = {
  client: '🟣 Заявка клиента (бизнес)',
  creator: '🟢 Заявка креатора',
};

/** ISO timestamp → readable Astana local time (UTC+5), e.g. "11.07.2026, 19:06".
 * Falls back to the raw value if it isn't a valid date. */
function formatAstana(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const s = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${s} (Астана)`;
}

/** Build a human-readable message body shared by Telegram + email. */
function formatLead(lead) {
  const title = FUNNEL_LABELS[lead.funnel] ?? 'Новая заявка';
  const lines = [title, ''];
  for (const [key, value] of Object.entries(lead.fields)) {
    if (value === undefined || value === null || value === '') continue;
    lines.push(`${key}: ${value}`);
  }
  lines.push('', `Время: ${formatAstana(lead.createdAt)}`);
  if (lead.page) lines.push(`Страница: ${lead.page}`);
  return lines.join('\n');
}

async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, skipped: true };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram error ${res.status}: ${body}`);
  }
  return { ok: true };
}

/** Best-effort operator alert to the Telegram ops group (never throws). */
export async function notifyOps(text) {
  try {
    await notifyTelegram(text);
  } catch (e) {
    console.error('[notify] ops failed:', e.message);
  }
}

/** True once the Telegram ops bot is configured (token + chat id present). */
export const telegramConfigured = () => !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

/**
 * Diagnostic: actually send a test message and return the real outcome (unlike
 * notifyOps, which swallows errors) so the operator can see WHY notifications
 * stopped — e.g. "chat not found" after the group became a supergroup (its
 * chat_id changes), a revoked token, or the bot being removed from the group.
 */
export async function telegramSelfTest() {
  if (!telegramConfigured()) {
    return { configured: false, ok: false, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы в переменных окружения' };
  }
  try {
    await notifyTelegram('✅ Тест уведомлений CLICKI — если ты это видишь, Telegram работает.');
    return { configured: true, ok: true };
  } catch (e) {
    return { configured: true, ok: false, error: e.message };
  }
}

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: String(SMTP_SECURE) === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function notifyEmail(text, lead) {
  const tx = getTransporter();
  const to = process.env.MAIL_TO;
  if (!tx || !to) return { ok: false, skipped: true };

  await tx.sendMail({
    from: process.env.MAIL_FROM || 'CLICKI <no-reply@localhost>',
    to,
    subject: FUNNEL_LABELS[lead.funnel] ?? 'CLICKI — новая заявка',
    text,
  });
  return { ok: true };
}

/**
 * Fan out a lead to all configured channels. Failures are isolated so a single
 * broken integration never blocks the others (or the user's form submission).
 */
export async function dispatchLead(lead) {
  const text = formatLead(lead);
  const results = await Promise.allSettled([notifyTelegram(text), notifyEmail(text, lead)]);
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[notify] channel ${i} failed:`, r.reason?.message || r.reason);
    }
  });
}
