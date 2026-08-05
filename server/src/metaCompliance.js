// Meta platform compliance callbacks required by the App Dashboard for the
// "Instagram API with Instagram login" product:
//
//   1. Deauthorize Callback URL  — Meta POSTs here when a user removes the app
//      in their Instagram settings. We must drop their token immediately.
//   2. Data Deletion Request URL — Meta POSTs here when a user asks Instagram
//      to delete the data the app holds about them. We must delete it and
//      reply with a status URL + confirmation code (Meta shows both to the user).
//
// Both arrive as `signed_request` (application/x-www-form-urlencoded), signed
// with the app secret: base64url(HMAC-SHA256) + '.' + base64url(JSON payload).
// Docs: developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

import crypto from 'node:crypto';

const APP_SECRET = process.env.IG_APP_SECRET;

/** base64url → Buffer (Node's 'base64url' handles missing padding). */
function b64urlDecode(str) {
  return Buffer.from(String(str || ''), 'base64url');
}

/**
 * Verify and parse Meta's signed_request. Returns the payload object
 * (contains user_id) or null when the signature doesn't match.
 */
export function parseSignedRequest(signedRequest, appSecret = APP_SECRET) {
  try {
    const [encodedSig, encodedPayload] = String(signedRequest || '').split('.', 2);
    if (!encodedSig || !encodedPayload || !appSecret) return null;
    const expected = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest();
    const actual = b64urlDecode(encodedSig);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    return JSON.parse(b64urlDecode(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }
}

/** Opaque confirmation code Meta shows to the user in their deletion status. */
export function makeConfirmationCode() {
  return `clicki-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Route handlers. Wired up with app-specific persistence so this module stays
 * dependency-free:
 *   clearByIgUserId(igUserId)          -> disconnect the account (deauthorize)
 *   deleteDataByIgUserId(igUserId)     -> full wipe of IG-derived data (deletion)
 *   recordDeletionRequest({ igUserId, code }) -> optional audit log
 *   statusUrlFor(code)                 -> public URL Meta will show to the user
 */
export function createMetaComplianceHandlers({
  clearByIgUserId,
  deleteDataByIgUserId,
  recordDeletionRequest = async () => {},
  statusUrlFor,
}) {
  return {
    // POST /api/auth/instagram/deauthorize
    async deauthorize(req, res) {
      const payload = parseSignedRequest(req.body?.signed_request);
      if (!payload?.user_id) return res.status(400).json({ ok: false });
      try {
        await clearByIgUserId(String(payload.user_id));
      } catch (err) {
        console.error('[ig-deauthorize]', err.message);
      }
      // Meta only needs a 200; body is ignored.
      res.json({ ok: true });
    },

    // POST /api/auth/instagram/data-deletion
    // Must answer { url, confirmation_code } — Meta relays both to the user.
    async dataDeletion(req, res) {
      const payload = parseSignedRequest(req.body?.signed_request);
      if (!payload?.user_id) return res.status(400).json({ ok: false });
      const igUserId = String(payload.user_id);
      const code = makeConfirmationCode();
      try {
        await deleteDataByIgUserId(igUserId);
        await recordDeletionRequest({ igUserId, code });
      } catch (err) {
        console.error('[ig-data-deletion]', err.message);
      }
      res.json({ url: statusUrlFor(code), confirmation_code: code });
    },

    // GET /api/auth/instagram/data-deletion-status?code=...
    // Meta links the user here; a human-readable confirmation is enough.
    async deletionStatus(req, res) {
      const code = String(req.query?.code || '').replace(/[^a-z0-9-]/gi, '');
      res
        .status(200)
        .type('html')
        .send(
          `<!doctype html><html lang="ru"><meta charset="utf-8">` +
            `<title>CLICKI — удаление данных</title>` +
            `<body style="font-family:system-ui;max-width:560px;margin:48px auto;padding:0 16px;color:#111">` +
            `<h1 style="font-size:20px">Данные Instagram удалены</h1>` +
            `<p>Запрос на удаление данных, связанных с вашим аккаунтом Instagram, выполнен. ` +
            `Токен доступа и данные аналитики, полученные через Instagram API, удалены из CLICKI.</p>` +
            (code ? `<p>Код подтверждения: <code>${code}</code></p>` : '') +
            `<p>Вопросы: <a href="mailto:no-reply@clicki.kz">поддержка CLICKI</a> · ` +
            `<a href="/privacy">Политика конфиденциальности</a></p></body></html>`
        );
    },
  };
}
