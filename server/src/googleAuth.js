/**
 * Google Sign-In (Google Identity Services) — TEST loop, /api/auth/google/*.
 *
 * Deliberately isolated from the live auth: its own table (google_test_users),
 * its own session tokens, no reads or writes to creators / business_accounts.
 * The point is to prove the Google flow end-to-end on production without any
 * risk to real users; once it's proven, the same verify step can be reused by
 * the real register/login endpoints.
 *
 * Flow (ID-token, not the redirect code flow):
 *   1. The client renders Google's button (GIS script) with our public client id.
 *   2. Google hands the browser a signed JWT ("credential") after the popup.
 *   3. The client POSTs it here; we verify the signature + audience against
 *      Google's published certs via google-auth-library (never trust the JWT
 *      payload without this step — anyone can mint an unsigned lookalike).
 *   4. Upsert by the stable Google account id (`sub`) and mint our own session
 *      token. `sub` is the identity key on purpose: an email can change or be
 *      recycled, `sub` never does.
 *
 * The client SECRET is not used anywhere in this flow — only the public client
 * id. Email lands here verified by Google, which is exactly what the future
 * mailing list needs.
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { pool } from './db.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const googleAuthEnabled = Boolean(GOOGLE_CLIENT_ID);

const oauthClient = googleAuthEnabled ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Same shape and lifetime as creator/business sessions (see index.js newToken).
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const newToken = () => crypto.randomBytes(24).toString('hex');

// Lazy, memoized table init instead of a hook inside initDb(): the feature stays
// one self-contained file, and unit tests can import this module without a
// database — nothing touches the pool until the first real Google login.
let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS google_test_users (
          id SERIAL PRIMARY KEY,
          google_sub VARCHAR(64) UNIQUE NOT NULL,
          email VARCHAR(320),
          email_verified BOOLEAN DEFAULT FALSE,
          name VARCHAR(200),
          avatar_url TEXT,
          marketing_consent BOOLEAN DEFAULT FALSE,
          session_token VARCHAR(64),
          session_expires_at TIMESTAMP,
          logins_count INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`)
      .catch((err) => {
        tableReady = null; // let the next request retry instead of caching the failure
        throw err;
      });
  }
  return tableReady;
}

/** Verify a GIS credential (JWT). Resolves to Google's payload or throws. */
export async function verifyGoogleIdToken(credential) {
  if (!oauthClient) throw new Error('GOOGLE_CLIENT_ID is not configured');
  const ticket = await oauthClient.verifyIdToken({
    idToken: String(credential),
    audience: GOOGLE_CLIENT_ID, // reject tokens issued for someone else's app
  });
  return ticket.getPayload();
}

// Session token never leaves the server inside the user object.
function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.email_verified === true,
    name: row.name,
    avatarUrl: row.avatar_url,
    marketingConsent: row.marketing_consent === true,
    loginsCount: row.logins_count,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

async function userByToken(token) {
  if (!token) return null;
  await ensureTable();
  const r = await pool.query(
    'SELECT * FROM google_test_users WHERE session_token = $1 AND session_expires_at > NOW()',
    [token]
  );
  return r.rows[0] || null;
}

/**
 * Mounted in index.js as app.use('/api/auth/google', ...). requireAdmin and
 * loginLimiter are injected from there so this module adds no second copy of
 * either policy.
 */
export function createGoogleAuthRouter({ requireAdmin, loginLimiter }) {
  const router = Router();

  // Public on purpose: the client id is not a secret (it ships inside every
  // Google button on the web). Serving it from here means the page needs no
  // VITE_* build-time variable — one server env var controls the whole feature.
  router.get('/config', (_req, res) => {
    res.json({ ok: true, enabled: googleAuthEnabled, clientId: GOOGLE_CLIENT_ID || null });
  });

  // Google credential in → our session token out.
  router.post('/test', loginLimiter, async (req, res) => {
    try {
      if (!googleAuthEnabled) {
        return res.status(503).json({ ok: false, errors: ['Вход через Google не настроен: задайте GOOGLE_CLIENT_ID на сервере'] });
      }
      const credential = String(req.body?.credential || '');
      if (!credential) return res.status(400).json({ ok: false, errors: ['Нет credential от Google'] });
      const marketingConsent = req.body?.marketingConsent === true || req.body?.marketingConsent === 'true';

      let payload;
      try {
        payload = await verifyGoogleIdToken(credential);
      } catch (err) {
        // Includes expired tokens, wrong audience, forged/garbage JWTs.
        console.error('[google-auth] verify failed:', err.message);
        return res.status(401).json({ ok: false, errors: ['Не удалось подтвердить вход через Google. Попробуйте ещё раз.'] });
      }
      if (!payload?.sub) {
        return res.status(401).json({ ok: false, errors: ['Google не вернул идентификатор аккаунта'] });
      }

      await ensureTable();
      const token = newToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      // `xmax = 0` is true only for a freshly inserted row — the standard
      // Postgres trick to tell INSERT from UPDATE inside one upsert, so the
      // client can show "новый аккаунт" vs "повторный вход" without a 2nd query.
      // marketing_consent only ever ratchets up here: a later login with the
      // checkbox left empty must not silently revoke consent already given.
      const r = await pool.query(
        `INSERT INTO google_test_users
           (google_sub, email, email_verified, name, avatar_url, marketing_consent, session_token, session_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (google_sub) DO UPDATE SET
           email = EXCLUDED.email,
           email_verified = EXCLUDED.email_verified,
           name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url,
           marketing_consent = google_test_users.marketing_consent OR EXCLUDED.marketing_consent,
           session_token = EXCLUDED.session_token,
           session_expires_at = EXCLUDED.session_expires_at,
           logins_count = google_test_users.logins_count + 1,
           last_login_at = CURRENT_TIMESTAMP
         RETURNING *, (xmax = 0) AS is_new`,
        [
          String(payload.sub),
          payload.email ? String(payload.email).slice(0, 320) : null,
          payload.email_verified === true,
          payload.name ? String(payload.name).slice(0, 200) : null,
          payload.picture ? String(payload.picture).slice(0, 2000) : null,
          marketingConsent,
          token,
          expiresAt,
        ]
      );
      const row = r.rows[0];
      res.json({ ok: true, token, isNew: row.is_new === true, user: publicUser(row) });
    } catch (err) {
      console.error('[google-auth]', err);
      res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
    }
  });

  // Session check for the test page ("does my token still work after refresh?").
  router.get('/test/me', async (req, res) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const row = await userByToken(token);
      if (!row) return res.status(401).json({ ok: false, errors: ['Сессия не найдена или истекла'] });
      res.json({ ok: true, user: publicUser(row) });
    } catch (err) {
      console.error('[google-auth me]', err);
      res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
    }
  });

  router.post('/test/logout', async (req, res) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (token) {
        await ensureTable();
        await pool.query(
          'UPDATE google_test_users SET session_token = NULL, session_expires_at = NULL WHERE session_token = $1',
          [token]
        );
      }
      res.json({ ok: true }); // idempotent: logging out twice is not an error
    } catch (err) {
      console.error('[google-auth logout]', err);
      res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
    }
  });

  // Operator's view of collected sign-ins (the future mailing list) — admin only.
  router.get('/test/users', requireAdmin, async (_req, res) => {
    try {
      await ensureTable();
      const r = await pool.query(
        `SELECT id, email, email_verified, name, marketing_consent, logins_count, created_at, last_login_at
         FROM google_test_users ORDER BY created_at DESC LIMIT 500`
      );
      res.json({ ok: true, users: r.rows });
    } catch (err) {
      console.error('[google-auth users]', err);
      res.status(500).json({ ok: false, errors: ['Внутренняя ошибка'] });
    }
  });

  return router;
}
