/**
 * PII masking for the public investor demo (/demo-admin).
 *
 * Those endpoints intentionally serve the REAL aggregate numbers with no auth,
 * but they previously also served raw leads — full name, phone and email of
 * everybody who ever filled in the form — to anyone who requested the URL.
 * Masking has to happen server-side: the demo page's own read-only guard is
 * client-side JS and does nothing for someone calling the endpoint with curl.
 *
 * The row maskers below are ALLOWLISTS, and that is the whole point. They used
 * to be denylists — spread the row, delete the bad fields — laid over queries
 * that `SELECT *`. So every column added later was public the day it shipped,
 * and nobody had to make a decision for it to leak. That is exactly how
 * creators' email addresses and TikTok handles (their real names, as it turns
 * out) and clients' live CTA links ended up on an unauthenticated endpoint.
 *
 * Name what leaves. A new column is then private until someone chooses
 * otherwise, and the choice is visible in a diff.
 */

/** Copy only `keys` out of `row`. Absent keys stay absent, not undefined. */
function pick(row, keys) {
  const out = {};
  if (!row) return out;
  for (const k of keys) if (k in row) out[k] = row[k];
  return out;
}

/** "Иван Петров" -> "И*** П*****": keeps the shape of a name, identifies nobody. */
export function maskName(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s
    .split(/\s+/)
    .map((word) => (word.length <= 1 ? word : `${word[0]}${'*'.repeat(Math.min(word.length - 1, 5))}`))
    .join(' ');
}

/** Masks phones, emails and @handles alike: enough shape to look real, not enough to reach anyone. */
export function maskContact(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const at = s.indexOf('@');
  if (at > 0) return `${s[0]}***${s.slice(at)}`; // e***@example.com
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 5) return `${s.slice(0, 2)}•••••${s.slice(-2)}`;
  return `${s[0]}***`;
}

/**
 * Leads are stored as a label→value map built from the funnel schema
 * (server/src/validate.js), e.g. { "Имя": …, "Телефон": …, "Компания": … }.
 * Company / niche / comment are not personal identifiers and pass through, so
 * the demo still shows meaningful rows.
 */
export function maskLeadFields(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([label, value]) => {
      if (/имя|name/i.test(label)) return [label, maskName(value)];
      if (/телефон|phone|email|почта|контакт|contact|telegram/i.test(label)) return [label, maskContact(value)];
      return [label, value];
    })
  );
}

/** A creator row as shown in demo tables: name + login masked, contact reduced. */
export function maskCreatorRow(row) {
  return { ...row, name: maskName(row.name), username: row.username ? maskName(row.username) : null };
}

/**
 * A creator for /api/demo/admin/creators. The only demo screen that reads it is
 * the "assign a creator" dropdown in the Брифы tab, which needs an id and a
 * label — so that is all it gets.
 *
 * It used to send the whole `SELECT c.*` row minus a few fields: email, bio,
 * city, avatar, lifetime earnings, and both social handles. `tiktok_username`
 * is filled from TikTok's `display_name`, i.e. the creator's actual name, and
 * it sat directly beside the masked one — so the masking bought nothing.
 */
const DEMO_CREATOR_FIELDS = ['id'];
export function maskCreatorForDemo(row) {
  return { ...pick(row, DEMO_CREATOR_FIELDS), name: maskName(row?.name) };
}

/**
 * A submission for /api/demo/admin/submissions — the fields the Проверка видео
 * and Просмотры по брифам tabs actually render, and no others.
 *
 * Deliberately absent: `req_cta_link` (the client's live campaign URL, joined in
 * from the brief — the same field maskBriefRow strips, which arrived here by the
 * other door), `screenshot_url` (a public URL to the creator's stats screenshot,
 * where their account name is legible — it undid the masked name next to it),
 * and the brief's other requirements, which no demo screen shows.
 *
 * `video_url` is listed but the caller must re-write it through safeHttpUrl —
 * it is creator-supplied text and must never reach an anonymous browser as a
 * `javascript:` URL.
 */
const DEMO_SUBMISSION_FIELDS = [
  'id', 'brief_id', 'brief_title', 'creator_id', 'platform', 'status',
  'views', 'views_history', 'video_url', 'published_at', 'rights_confirmed',
  'ai_score', 'ai_feedback', 'coach_feedback', 'review_note', 'reject_code', 'fraud',
  'screenshots_count', 'last_screenshot_at',
];
export function maskSubmissionRow(row) {
  return { ...pick(row, DEMO_SUBMISSION_FIELDS), creator_name: maskName(row?.creator_name) };
}

/**
 * A brief row for the demo queue. A brief is a paying client's campaign — its
 * goal, audience, key message, do's and don'ts, and a live CTA link to their
 * site — and all of it used to leave /api/demo/admin/briefs unmasked while every
 * neighbouring endpoint masked what it served.
 *
 * The demo exists to show the moderation *flow*, so what stays is what the page
 * actually renders. The creative itself is dropped rather than starred out —
 * there is no shape worth preserving in a paragraph of someone's strategy.
 *
 * This was a denylist first, and it aged badly within a day: `business_id` and
 * `tone` were leaving simply because nobody had listed them, and the CTA link it
 * did strip turned out to reach the public through the submissions endpoint
 * anyway. An allowlist can't rot that way.
 *
 * Known and left in: `ai_feedback` routinely quotes the key message back (the
 * model is asked to critique it) and `revision_note` is the operator's note to
 * the client. Both are rendered by the demo queue, so removing them is a product
 * call, not a bug fix — raised separately.
 */
const DEMO_BRIEF_FIELDS = [
  'id', 'title', 'status', 'platform', 'duration_max', 'req_hashtag', 'spec',
  'ai_score', 'ai_feedback', 'revision_note',
];
export function maskBriefRow(row) {
  return pick(row, DEMO_BRIEF_FIELDS);
}
