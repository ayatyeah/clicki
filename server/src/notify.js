import nodemailer from 'nodemailer';

const FUNNEL_LABELS = {
  client: '🟣 Заявка клиента (бизнес)',
  creator: '🟢 Заявка креатора',
};

/** Build a human-readable message body shared by Telegram + email. */
function formatLead(lead) {
  const title = FUNNEL_LABELS[lead.funnel] ?? 'Новая заявка';
  const lines = [title, ''];
  for (const [key, value] of Object.entries(lead.fields)) {
    if (value === undefined || value === null || value === '') continue;
    lines.push(`${key}: ${value}`);
  }
  lines.push('', `Время: ${lead.createdAt}`);
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
