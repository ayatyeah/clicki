import crypto from 'node:crypto';
import pg from 'pg';
const { Pool } = pg;

// Public "UGC creator" code shown on the creator and in the admin — random, not
// sequential, so it reveals nothing about signup order or how many creators there
// are. Ambiguous characters (0/O, 1/l/I) are left out so it's easy to read aloud.
const UGC_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export function generateUgcCode() {
  const bytes = crypto.randomBytes(9);
  let code = '';
  for (let i = 0; i < 9; i++) code += UGC_ALPHABET[bytes[i] % UGC_ALPHABET.length];
  return code;
}

// The 24-hour rule. A brief slot is occupied only while a creator still "holds"
// it: either they've already submitted a video (slot spent) or they took the
// brief within the last 24 hours (still inside their window). A holder who did
// neither has let the slot lapse — it reopens for one more creator. Written
// against an `assignments a` row; shared by the slot count in takeBrief() and the
// availability filter in listActiveBriefsRanked() so both agree on who counts.
const ACTIVE_HOLDER_SQL = `(
  a.created_at > NOW() - INTERVAL '24 hours'
  OR EXISTS (SELECT 1 FROM submissions s WHERE s.brief_id = a.brief_id AND s.creator_id = a.creator_id)
)`;

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
// A managed Postgres backend can drop an idle connection at any time (network
// blip, provider-side recycling). Without this listener, pg.Pool emits an
// unhandled 'error' event that crashes the whole Node process — the real
// cause behind the site randomly going down and DO's edge showing a 404.
pool.on('error', (err) => {
  console.error('[db] idle client error (ignored, pool recovers):', err.message);
});

// ---- Admin sessions (persisted so they survive redeploys) ----
export async function saveAdminSession(token, expiresAt) {
  await pool.query(
    `INSERT INTO admin_sessions (token, expires_at) VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [token, expiresAt]
  );
}
export async function getAdminSessionExpiry(token) {
  const r = await pool.query('SELECT expires_at FROM admin_sessions WHERE token = $1', [token]);
  return r.rows[0]?.expires_at || null;
}
export async function deleteAdminSession(token) {
  await pool.query('DELETE FROM admin_sessions WHERE token = $1', [token]);
}
export async function cleanupAdminSessions() {
  await pool.query('DELETE FROM admin_sessions WHERE expires_at <= NOW()');
}

export async function initDb() {
  const client = await pool.connect();
  try {
    // ---- Marketing site (existing) ----
    await client.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        src TEXT NOT NULL,
        poster TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS media (
        id SERIAL PRIMARY KEY,
        mime VARCHAR(120) NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    // Persistent site content (device images + creator video) — survives redeploys
    await client.query(`CREATE TABLE IF NOT EXISTS site_content (id INT PRIMARY KEY DEFAULT 1, data JSONB NOT NULL DEFAULT '{}'::jsonb)`);
    await client.query(`INSERT INTO site_content (id, data) VALUES (1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`);
    // AI analysis cache (economical Gemini usage)
    await client.query(`CREATE TABLE IF NOT EXISTS ai_cache (id INT PRIMARY KEY DEFAULT 1, input_hash TEXT, result TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    // Lightweight first-party visit log (powers the admin analytics page)
    await client.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id BIGSERIAL PRIMARY KEY,
        path VARCHAR(300),
        referrer VARCHAR(200),
        visitor VARCHAR(64),
        is_mobile BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS visits_created_at_idx ON visits (created_at)`);
    await client.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS kind VARCHAR(12) DEFAULT 'page'");
    await client.query('ALTER TABLE visits ADD COLUMN IF NOT EXISTS label VARCHAR(160)');

    // ---- Platform (ТЗ) ----
    // Rates per platform — single source of truth (ТЗ §2)
    await client.query(`
      CREATE TABLE IF NOT EXISTS rates (
        platform VARCHAR(40) PRIMARY KEY,
        client_rate NUMERIC(6,2) NOT NULL,
        creator_rate NUMERIC(6,2) NOT NULL
      )`);
    // Numeric thresholds/settings (ТЗ §2)
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(60) PRIMARY KEY,
        value NUMERIC NOT NULL
      )`);
    // Creators (ТЗ §3, §4)
    await client.query(`
      CREATE TABLE IF NOT EXISTS creators (
        id SERIAL PRIMARY KEY,
        tg_id BIGINT UNIQUE,
        name VARCHAR(160) NOT NULL,
        contact VARCHAR(200),
        socials TEXT,
        city VARCHAR(120),
        account_open BOOLEAN DEFAULT FALSE,
        onboarding_passed BOOLEAN DEFAULT FALSE,
        xp INTEGER DEFAULT 0,
        trust_score INTEGER DEFAULT 100,
        streak INTEGER DEFAULT 0,
        freeze_tokens INTEGER DEFAULT 2,
        last_streak_date DATE,
        founding BOOLEAN DEFAULT FALSE,
        referred_by INTEGER REFERENCES creators(id),
        referral_qualified BOOLEAN DEFAULT FALSE,
        status VARCHAR(30) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    // Credential login for the creator cabinet (added after initial release).
    await client.query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS username VARCHAR(80)`);
    await client.query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS password_hash TEXT`);
    await client.query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS session_token TEXT`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS creators_username_key ON creators (lower(username))`);
    // Random public "UGC creator" code per creator (not sequential). New creators
    // get one in createCreator; existing ones are backfilled here, one at a time
    // so each gets a distinct random value under the unique index.
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS ugc_code VARCHAR(16)');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS creators_ugc_code_key ON creators (ugc_code)');
    const needCode = await client.query('SELECT id FROM creators WHERE ugc_code IS NULL');
    for (const row of needCode.rows) {
      // Retry on the astronomically rare collision with an already-issued code.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await client.query('UPDATE creators SET ugc_code = $1 WHERE id = $2', [generateUgcCode(), row.id]);
          break;
        } catch (e) {
          if (e.code !== '23505') throw e;
        }
      }
    }
    // Briefs as structured data (ТЗ §9.2, §9.3)
    await client.query(`
      CREATE TABLE IF NOT EXISTS briefs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        goal TEXT,
        audience TEXT,
        key_message TEXT,
        platform VARCHAR(40) NOT NULL,
        duration_min INTEGER DEFAULT 15,
        duration_max INTEGER DEFAULT 90,
        req_hashtag VARCHAR(80),
        req_mention BOOLEAN DEFAULT FALSE,
        req_cta_link TEXT,
        dos TEXT,
        donts TEXT,
        tone VARCHAR(120),
        refs TEXT,
        slots INTEGER DEFAULT 0,
        status VARCHAR(30) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    // Business (client/brand) self-service accounts + their briefs
    await client.query(`
      CREATE TABLE IF NOT EXISTS business_accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        email VARCHAR(200) NOT NULL,
        company VARCHAR(200),
        password_hash TEXT NOT NULL,
        session_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS business_email_key ON business_accounts (lower(email))`);
    // Briefs created from the business cabinet: link + detailed creative spec (JSON).
    await client.query('ALTER TABLE briefs ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES business_accounts(id) ON DELETE SET NULL');
    await client.query(`ALTER TABLE briefs ADD COLUMN IF NOT EXISTS spec JSONB DEFAULT '{}'::jsonb`);
    // Brief moderation: AI quality check + revision note (business → us → creators/back)
    await client.query('ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_score INTEGER');
    await client.query('ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_feedback TEXT');
    await client.query('ALTER TABLE briefs ADD COLUMN IF NOT EXISTS revision_note TEXT');

    // Brief → creator assignment (ТЗ §3 step 3)
    await client.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        brief_id INTEGER REFERENCES briefs(id) ON DELETE CASCADE,
        creator_id INTEGER REFERENCES creators(id) ON DELETE CASCADE,
        status VARCHAR(30) DEFAULT 'assigned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brief_id, creator_id)
      )`);
    // Video submissions + review + views (ТЗ §3 step 4-5, §9)
    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        brief_id INTEGER REFERENCES briefs(id) ON DELETE SET NULL,
        creator_id INTEGER REFERENCES creators(id) ON DELETE CASCADE,
        platform VARCHAR(40) NOT NULL,
        video_url TEXT NOT NULL,
        published_at DATE,
        screenshot_url TEXT,
        rights_confirmed BOOLEAN DEFAULT FALSE,
        checklist JSONB,
        status VARCHAR(30) DEFAULT 'pending',
        reject_code VARCHAR(60),
        reviewed_at TIMESTAMP,
        views INTEGER DEFAULT 0,
        views_final BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    // AI auto-check result + AI Coach note on submissions. Must run AFTER the
    // CREATE above — ALTER on a not-yet-created table throws on a fresh DB.
    await client.query('ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_score INTEGER');
    await client.query('ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_feedback TEXT');
    await client.query('ALTER TABLE submissions ADD COLUMN IF NOT EXISTS coach_feedback TEXT');
    // Admin sessions persisted so they survive a server restart / redeploy —
    // otherwise the in-memory session map is wiped on every deploy and the
    // operator gets bounced to the login screen mid-work.
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL
      )`);
    // Payouts (ТЗ §8)
    await client.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id SERIAL PRIMARY KEY,
        creator_id INTEGER REFERENCES creators(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL,
        method VARCHAR(40) DEFAULT 'kaspi',
        status VARCHAR(30) DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    // Seed rates (ТЗ §2) — idempotent
    const seedRates = [
      ['TikTok', 0.8, 0.24],
      ['Instagram Reels', 0.85, 0.28],
      ['YouTube Shorts', 0.7, 0.22],
      ['Threads', 1.1, 0.45],
      ['X (Twitter)', 1.2, 0.45],
    ];
    for (const [p, c, cr] of seedRates) {
      await client.query(
        'INSERT INTO rates (platform, client_rate, creator_rate) VALUES ($1,$2,$3) ON CONFLICT (platform) DO NOTHING',
        [p, c, cr]
      );
    }
    // Seed thresholds (ТЗ §2)
    const seedSettings = [
      ['min_views_per_video', 2000],
      ['invoice_threshold', 50000],
      ['payout_threshold', 10000],
      // Founding-creator cap. Configurable — set as high as desired (0 = unlimited).
      ['founding_cap', 50],
    ];
    for (const [k, v] of seedSettings) {
      await client.query('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING', [k, v]);
    }
    // Migrations for already-created tables
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS referral_qualified BOOLEAN DEFAULT FALSE');
    // Bonus XP earned outside the views formula (referral bonuses etc.) — kept
    // separate so recomputeXp() can fold it back in instead of overwriting it.
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS bonus_xp INTEGER DEFAULT 0');
    // Business leads that arrived through a creator's public referral link
    // (put in their profile/bio) — separate from the creator-invites-creator
    // flow above, powers admin analytics + a small XP bonus per lead.
    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_leads (
        id SERIAL PRIMARY KEY,
        creator_id INTEGER REFERENCES creators(id) ON DELETE SET NULL,
        funnel VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS referral_leads_creator_idx ON referral_leads (creator_id)');
    // Decision journal — append-only log of every accept/reject/rework call an
    // operator makes on a submission: what happened, why, how many views it had,
    // how long the decision took. Not AI itself — the training data future AI
    // will need. Survives independently of whatever happens to the submission next.
    await client.query(`
      CREATE TABLE IF NOT EXISTS submission_decisions (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
        creator_id INTEGER REFERENCES creators(id) ON DELETE SET NULL,
        brief_id INTEGER REFERENCES briefs(id) ON DELETE SET NULL,
        status VARCHAR(30) NOT NULL,
        reject_code VARCHAR(60),
        views_at_decision INTEGER DEFAULT 0,
        seconds_to_decision INTEGER,
        decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS submission_decisions_submission_idx ON submission_decisions (submission_id)');
    // View-count history behind the single submissions.views column — each
    // manual view-count entry (ТЗ §9) is appended here instead of only overwriting
    // the latest value. Powers the anti-fraud growth-shape signal and the
    // business live growth dashboard.
    await client.query(`
      CREATE TABLE IF NOT EXISTS view_snapshots (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
        views INTEGER NOT NULL,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS view_snapshots_submission_idx ON view_snapshots (submission_id)');
    // Anti-fraud thresholds — tunable via /api/admin/settings like the other
    // numeric knobs, so the heuristic can be adjusted as real data comes in.
    const seedFraudSettings = [
      ['fraud_max_views_per_hour', 5000],
      ['fraud_min_smoothness_cv', 0.15],
    ];
    for (const [k, v] of seedFraudSettings) {
      await client.query('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING', [k, v]);
    }
    // TikTok account connection (Login Kit + Display API) — lets us auto-fetch
    // view_count for a creator's videos instead of an operator typing it in.
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS tiktok_open_id TEXT');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS tiktok_username VARCHAR(120)');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS tiktok_access_token TEXT');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS tiktok_refresh_token TEXT');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS tiktok_token_expires_at TIMESTAMP');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS tiktok_refresh_expires_at TIMESTAMP');
    // Instagram (Instagram Login for Business): one long-lived token, refreshed
    // in place — no separate refresh token like TikTok.
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS ig_user_id TEXT');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS ig_username VARCHAR(120)');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS ig_access_token TEXT');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS ig_token_expires_at TIMESTAMP');
    // Short-lived CSRF state ↔ creator mapping for the OAuth redirect round-trip
    // (TikTok's redirect_uri must be static, so we can't carry the creator id in it).
    await client.query(`
      CREATE TABLE IF NOT EXISTS oauth_states (
        state VARCHAR(80) PRIMARY KEY,
        creator_id INTEGER REFERENCES creators(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    // Ties an auto-created payout back to the submission that earned it — lets
    // us reason about (and audit) exactly which video a payout came from.
    await client.query('ALTER TABLE payouts ADD COLUMN IF NOT EXISTS submission_id INTEGER REFERENCES submissions(id) ON DELETE SET NULL');
    // Session tokens (creator + business) now expire — previously valid forever,
    // meaning a leaked token was permanent, unrevocable account access.
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMP');
    await client.query('ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMP');
    // Account profiles: creator avatar/bio/topics (topics also drives the onboarding
    // niche picker) and a business logo, editable from the "My account" screens.
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS avatar_url TEXT');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS bio TEXT');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS topics TEXT');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS email VARCHAR(200)');
    await client.query('ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS logo_url TEXT');
    // How we reach a brand: phone or Telegram handle. Required on every new
    // account (register + admin create) and to save the profile, but the column
    // stays nullable — accounts created before this shipped have no contact, and
    // a NOT NULL would fail this migration on boot against the live database.
    // Backfill happens as each brand saves its profile / an operator fills it in.
    await client.query('ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS contact VARCHAR(200)');
    // Temporary bans: status='banned' + banned_until (NULL = permanent). Auth
    // auto-unbans once banned_until has passed.
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP');

    // Leads used to live in server/data/leads.jsonl. On an ephemeral-filesystem
    // host (DO App Platform) that file is destroyed on every redeploy, silently
    // losing every lead the site had collected. They belong in the DB, like media.
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id BIGSERIAL PRIMARY KEY,
        funnel VARCHAR(20) NOT NULL,
        fields JSONB NOT NULL DEFAULT '{}'::jsonb,
        page VARCHAR(200),
        ref VARCHAR(40),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC)');

    // ---- Hot-path indexes ----
    // Every authenticated request resolves a bearer token to an account. Without
    // these two, that is a sequential scan of the whole table on each request.
    await client.query('CREATE INDEX IF NOT EXISTS creators_session_token_idx ON creators (session_token)');
    await client.query('CREATE INDEX IF NOT EXISTS business_session_token_idx ON business_accounts (session_token)');
    // Foreign keys Postgres does NOT index automatically — these back the joins
    // and per-account lookups in the creator/business/admin dashboards.
    await client.query('CREATE INDEX IF NOT EXISTS submissions_creator_idx ON submissions (creator_id)');
    await client.query('CREATE INDEX IF NOT EXISTS submissions_brief_idx ON submissions (brief_id)');
    await client.query('CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status)');
    await client.query('CREATE INDEX IF NOT EXISTS assignments_creator_idx ON assignments (creator_id)');
    await client.query('CREATE INDEX IF NOT EXISTS assignments_brief_idx ON assignments (brief_id)');
    await client.query('CREATE INDEX IF NOT EXISTS payouts_creator_idx ON payouts (creator_id)');
    await client.query('CREATE INDEX IF NOT EXISTS briefs_business_idx ON briefs (business_id)');
    await client.query('CREATE INDEX IF NOT EXISTS briefs_status_idx ON briefs (status)');
    // getVisitAnalytics() filters every aggregate on kind, then groups by day.
    await client.query('CREATE INDEX IF NOT EXISTS visits_kind_created_idx ON visits (kind, created_at)');

    // Daily stats screenshots: after submitting a video the creator uploads a
    // fresh TikTok/Instagram stats screenshot every 24h. Kept forever (никогда
    // не удаляются) as proof of organic growth over the video's life.
    await client.query(`
      CREATE TABLE IF NOT EXISTS stat_screenshots (
        id BIGSERIAL PRIMARY KEY,
        submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        day_key DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS stat_screenshots_submission_idx ON stat_screenshots (submission_id, created_at DESC)');

    // Clicks on a creator's referral / bio link (clicki-platform.com/ref/<login>).
    // One row per (creator, visitor, day) so refreshing the page doesn't inflate
    // the count — "people who opened your link", not raw hits.
    await client.query(`
      CREATE TABLE IF NOT EXISTS ref_visits (
        creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
        visitor VARCHAR(64) NOT NULL,
        day_key DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (creator_id, visitor, day_key)
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS ref_visits_creator_idx ON ref_visits (creator_id)');

    // A lead clicking through from a creator's mini-page to a brand's own site
    // (the brand plaque → req_cta_link). Attributed to the brief (hence the
    // business) and the creator who sent them, deduped per visitor per day so a
    // refresh doesn't inflate it. This is what will let us tell a business, later,
    // "N creators promoted your brief and M leads clicked through to you."
    await client.query(`
      CREATE TABLE IF NOT EXISTS brand_clicks (
        brief_id INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
        creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
        visitor VARCHAR(64) NOT NULL,
        day_key DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (brief_id, creator_id, visitor, day_key)
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS brand_clicks_brief_idx ON brand_clicks (brief_id)');

    // Presence: last authenticated request per account. Powers "online now" on
    // the admin health page. Written at most once a minute per account (see
    // touchSeen), so it costs effectively nothing on the hot path.
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP');
    await client.query('ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP');
    await client.query('CREATE INDEX IF NOT EXISTS creators_last_seen_idx ON creators (last_seen_at)');
    await client.query('CREATE INDEX IF NOT EXISTS business_last_seen_idx ON business_accounts (last_seen_at)');

    // Announcements: an in-app broadcast the admin sends to every creator. They
    // surface in the creator cabinet's notification bell; no external message is
    // sent, so a creator only ever sees one when the admin explicitly creates it.
    // announcements_seen_at marks when a creator last opened the bell → unread =
    // announcements newer than that.
    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id BIGSERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements (created_at DESC)');
    await client.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS announcements_seen_at TIMESTAMP');
    // creator_id NULL = broadcast to everyone; set = a private message to one creator.
    await client.query('ALTER TABLE announcements ADD COLUMN IF NOT EXISTS creator_id INTEGER REFERENCES creators(id) ON DELETE CASCADE');
    // Admin's own written reason/comment on a submission (e.g. why it was rejected),
    // separate from the AI feedback. Editable any time, shown to the creator.
    await client.query('ALTER TABLE submissions ADD COLUMN IF NOT EXISTS review_note TEXT');
  } finally {
    client.release();
  }
}

/* ---------------- Presence ---------------- */
/** Bump last_seen_at, but only if it's already a minute stale — one UPDATE per
 *  account per minute instead of one per request. */
export async function touchCreatorSeen(id) {
  await pool.query(
    "UPDATE creators SET last_seen_at = NOW() WHERE id = $1 AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '1 minute')",
    [id]
  );
}
export async function touchBusinessSeen(id) {
  await pool.query(
    "UPDATE business_accounts SET last_seen_at = NOW() WHERE id = $1 AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '1 minute')",
    [id]
  );
}

/** Full presence roster for the admin "Онлайн" panel — every creator and business
 *  with their last activity time (most-recent first). Online/offline is derived on
 *  the client from lastSeenAt so the panel can show a live countdown. */
export async function getPresenceRoster() {
  const [creators, businesses] = await Promise.all([
    pool.query('SELECT id, name, username, status, last_seen_at FROM creators ORDER BY last_seen_at DESC NULLS LAST, id DESC'),
    pool.query('SELECT id, name, email, company, last_seen_at FROM business_accounts ORDER BY last_seen_at DESC NULLS LAST, id DESC'),
  ]);
  const iso = (v) => v?.toISOString?.() ?? v ?? null;
  return {
    creators: creators.rows.map((r) => ({
      id: r.id, name: r.name, username: r.username || null, status: r.status, lastSeenAt: iso(r.last_seen_at),
    })),
    businesses: businesses.rows.map((r) => ({
      id: r.id, name: r.name || r.company || r.email, email: r.email || null, lastSeenAt: iso(r.last_seen_at),
    })),
  };
}

/* ---------------- Site health (admin overview) ---------------- */
/** A creator/business counts as "online" if a request of theirs authenticated
 *  within this window. Kept generous because the cabinets don't poll. */
const ONLINE_WINDOW = "5 minutes";

/**
 * One snapshot of everything worth watching: accounts, pipeline, money, traffic.
 * Every query is a plain aggregate over an indexed column and they all run
 * concurrently, so the whole page costs one round-trip's worth of latency.
 */
export async function getSiteHealth() {
  const one = (text, params) => pool.query(text, params).then((r) => r.rows[0]);
  const many = (text, params) => pool.query(text, params).then((r) => r.rows);

  const [creators, businesses, briefs, submissions, leads, payouts, traffic, referrals] = await Promise.all([
    one(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'active')::int AS active,
             COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
             COUNT(*) FILTER (WHERE onboarding_passed)::int AS onboarded,
             COUNT(*) FILTER (WHERE founding)::int AS founding,
             COUNT(*) FILTER (WHERE username IS NOT NULL)::int AS with_login,
             COUNT(*) FILTER (WHERE tiktok_access_token IS NOT NULL)::int AS tiktok_connected,
             COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '${ONLINE_WINDOW}')::int AS online,
             COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '24 hours')::int AS active_24h,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d
        FROM creators`),
    one(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '${ONLINE_WINDOW}')::int AS online,
             COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '24 hours')::int AS active_24h,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d
        FROM business_accounts`),
    one(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'new')::int AS moderation,
             COUNT(*) FILTER (WHERE status = 'active')::int AS active,
             COUNT(*) FILTER (WHERE status = 'revision')::int AS revision
        FROM briefs`),
    one(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'ai_check')::int AS ai_check,
             COUNT(*) FILTER (WHERE status = 'ai_passed')::int AS awaiting_review,
             COUNT(*) FILTER (WHERE status = 'rework')::int AS rework,
             COUNT(*) FILTER (WHERE status = 'sent_to_business')::int AS awaiting_business,
             COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
             COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
             COALESCE(SUM(views) FILTER (WHERE status = 'accepted'), 0)::bigint AS accepted_views,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d
        FROM submissions`),
    one(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS today,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS week,
             COUNT(*) FILTER (WHERE funnel = 'client')::int AS client,
             COUNT(*) FILTER (WHERE funnel = 'creator')::int AS creator
        FROM leads`),
    one(`
      SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
             COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::float AS pending_sum,
             COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::float AS paid_sum
        FROM payouts`),
    one(`
      SELECT COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE AND (kind='page' OR kind IS NULL))::int AS visits_today,
             COUNT(DISTINCT visitor) FILTER (WHERE created_at::date = CURRENT_DATE AND (kind='page' OR kind IS NULL))::int AS uniques_today,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days' AND (kind='page' OR kind IS NULL))::int AS visits_7d
        FROM visits`),
    one('SELECT COUNT(*)::int AS total FROM referral_leads'),
  ]);

  // Newest first, so an operator can see who is actually in the cabinet right now.
  const onlineNow = await many(`
    SELECT 'creator' AS role, id, name, last_seen_at FROM creators
     WHERE last_seen_at > NOW() - INTERVAL '${ONLINE_WINDOW}'
    UNION ALL
    SELECT 'business' AS role, id, name, last_seen_at FROM business_accounts
     WHERE last_seen_at > NOW() - INTERVAL '${ONLINE_WINDOW}'
    ORDER BY last_seen_at DESC LIMIT 20`);

  return {
    creators,
    businesses,
    briefs,
    submissions: { ...submissions, accepted_views: Number(submissions.accepted_views) },
    leads,
    payouts,
    traffic,
    referrals: referrals.total,
    onlineNow,
    onlineWindow: ONLINE_WINDOW,
  };
}

/** Round-trip latency to Postgres, in milliseconds. */
export async function measureDbLatency() {
  const t0 = process.hrtime.bigint();
  await pool.query('SELECT 1');
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

/** Connection-pool saturation — the thing that silently queues requests under load. */
export function getPoolStats() {
  return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max };
}

/* ---------------- Leads (lead-capture funnels) ---------------- */
export async function insertLead(lead) {
  const r = await pool.query(
    'INSERT INTO leads (funnel, fields, page, ref, created_at) VALUES ($1,$2,$3,$4,COALESCE($5, CURRENT_TIMESTAMP)) RETURNING id',
    [lead.funnel, JSON.stringify(lead.fields || {}), lead.page || null, lead.ref || null, lead.createdAt || null]
  );
  return r.rows[0].id;
}

/** Newest first — matches the previous JSONL-reverse behaviour the admin UI expects. */
export async function listLeads(limit = 1000) {
  const r = await pool.query(
    'SELECT id, funnel, fields, page, ref, created_at FROM leads ORDER BY created_at DESC, id DESC LIMIT $1',
    [limit]
  );
  return r.rows.map((row) => ({
    id: row.id,
    funnel: row.funnel,
    fields: row.fields,
    page: row.page || undefined,
    ref: row.ref || undefined,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  }));
}

export async function countLeads() {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM leads');
  return r.rows[0].n;
}
export async function deleteLead(id) {
  const r = await pool.query('DELETE FROM leads WHERE id = $1', [id]);
  return r.rowCount > 0;
}

/* ---------------- Announcements (creator broadcast bell) ---------------- */
function mapAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body || '',
    creatorId: row.creator_id ?? null,
    creatorName: row.creator_name ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  };
}
/** Create a notification. creatorId NULL = broadcast to everyone; set = private
 *  message to that one creator. Instantly visible in the target bell(s). */
export async function createAnnouncement({ title, body, creatorId = null }) {
  const r = await pool.query(
    'INSERT INTO announcements (title, body, creator_id) VALUES ($1, $2, $3) RETURNING id, title, body, creator_id, created_at',
    [title, body || '', creatorId]
  );
  return mapAnnouncement(r.rows[0]);
}
/** Admin history of everything sent so far (with the target creator's name). */
export async function listAnnouncements(limit = 50) {
  const r = await pool.query(
    `SELECT a.id, a.title, a.body, a.creator_id, a.created_at, c.name AS creator_name
       FROM announcements a LEFT JOIN creators c ON c.id = a.creator_id
      ORDER BY a.created_at DESC, a.id DESC LIMIT $1`,
    [limit]
  );
  return r.rows.map(mapAnnouncement);
}
export async function deleteAnnouncement(id) {
  const r = await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
  return r.rowCount > 0;
}
/** The creator's bell: recent notifications addressed to them — broadcasts
 *  (creator_id IS NULL) plus their own private messages — with the unread count. */
export async function getCreatorAnnouncements(creatorId, limit = 30) {
  const seenR = await pool.query('SELECT announcements_seen_at FROM creators WHERE id = $1', [creatorId]);
  const seenAt = seenR.rows[0]?.announcements_seen_at ?? null;
  const r = await pool.query(
    `SELECT id, title, body, creator_id, created_at FROM announcements
      WHERE creator_id IS NULL OR creator_id = $1
      ORDER BY created_at DESC, id DESC LIMIT $2`,
    [creatorId, limit]
  );
  const items = r.rows.map((row) => ({ ...mapAnnouncement(row), unread: !seenAt || row.created_at > seenAt }));
  const countR = await pool.query(
    `SELECT COUNT(*)::int AS n FROM announcements
      WHERE (creator_id IS NULL OR creator_id = $1) AND ($2::timestamp IS NULL OR created_at > $2)`,
    [creatorId, seenAt]
  );
  return { items, unread: countR.rows[0].n };
}
/** Mark the bell as read for this creator (called when they open it). */
export async function markCreatorAnnouncementsSeen(creatorId) {
  await pool.query('UPDATE creators SET announcements_seen_at = NOW() WHERE id = $1', [creatorId]);
}

/** Cheap connectivity check for /api/health — a real DB round-trip, not just
 * "the process is up" (that alone would report healthy through an outage). */
export async function pingDb() {
  await pool.query('SELECT 1');
}

/* ---------------- Showcase videos (CMS feed) ---------------- */
export async function getVideos() {
  const result = await pool.query('SELECT * FROM videos ORDER BY id ASC');
  return result.rows.map((row) => ({ type: row.type, src: row.src, poster: row.poster }));
}
export async function saveVideos(videos) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM videos');
    for (const v of videos) {
      await client.query('INSERT INTO videos (type, src, poster) VALUES ($1, $2, $3)', [v.type, v.src, v.poster]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* ---------------- Media blobs ---------------- */
export async function saveMedia(mime, buffer) {
  const result = await pool.query('INSERT INTO media (mime, data) VALUES ($1, $2) RETURNING id', [mime, buffer]);
  return result.rows[0].id;
}
export async function getMedia(id) {
  const result = await pool.query('SELECT mime, data FROM media WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return { mime: result.rows[0].mime, data: result.rows[0].data };
}
export async function getMediaMeta(id) {
  const result = await pool.query('SELECT mime FROM media WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return { mime: result.rows[0].mime };
}

/* ---------------- Persistent site content (devices + creator video) ---------------- */
export async function getSiteContent() {
  const r = await pool.query('SELECT data FROM site_content WHERE id=1');
  return r.rows[0]?.data || {};
}
export async function saveSiteContent(data) {
  await pool.query(
    `INSERT INTO site_content (id, data) VALUES (1,$1) ON CONFLICT (id) DO UPDATE SET data=$1`,
    [JSON.stringify(data)]
  );
}

/* ---------------- Visit analytics (first-party) ---------------- */
export async function recordVisit({ path, referrer, visitor, is_mobile, kind, label }) {
  await pool.query(
    'INSERT INTO visits (path, referrer, visitor, is_mobile, kind, label) VALUES ($1,$2,$3,$4,$5,$6)',
    [
      (path || '/').slice(0, 300),
      referrer ? referrer.slice(0, 200) : null,
      visitor || null,
      !!is_mobile,
      kind === 'click' ? 'click' : 'page',
      label ? String(label).slice(0, 160) : null,
    ]
  );
}
export async function getVisitAnalytics() {
  const rows = (text) => pool.query(text).then((r) => r.rows);
  const PAGE = "(kind='page' OR kind IS NULL)";
  const [totals] = await rows(`SELECT COUNT(*)::int AS visits, COUNT(DISTINCT visitor)::int AS uniques FROM visits WHERE ${PAGE}`);
  const [today] = await rows(
    `SELECT COUNT(*)::int AS visits, COUNT(DISTINCT visitor)::int AS uniques FROM visits WHERE ${PAGE} AND created_at::date = CURRENT_DATE`
  );
  const byDay = await rows(
    "SELECT to_char(created_at::date,'YYYY-MM-DD') AS day, COUNT(*)::int AS visits, COUNT(DISTINCT visitor)::int AS uniques " +
      `FROM visits WHERE ${PAGE} AND created_at >= CURRENT_DATE - INTERVAL '13 days' GROUP BY created_at::date ORDER BY created_at::date`
  );
  const byPage = await rows(`SELECT path, COUNT(*)::int AS visits FROM visits WHERE ${PAGE} GROUP BY path ORDER BY visits DESC LIMIT 12`);
  const bySource = await rows(
    `SELECT COALESCE(NULLIF(referrer,''),'прямой переход') AS source, COUNT(*)::int AS visits FROM visits WHERE ${PAGE} GROUP BY 1 ORDER BY visits DESC LIMIT 12`
  );
  const [device] = await rows(
    `SELECT COUNT(*) FILTER (WHERE is_mobile)::int AS mobile, COUNT(*) FILTER (WHERE NOT is_mobile)::int AS desktop FROM visits WHERE ${PAGE}`
  );
  const topClicks = await rows(
    "SELECT label, COUNT(*)::int AS clicks FROM visits WHERE kind='click' AND label IS NOT NULL GROUP BY label ORDER BY clicks DESC LIMIT 12"
  );
  return { totals, today, byDay, byPage, bySource, device, topClicks };
}

/* ---------------- AI analysis cache ---------------- */
export async function getAiCache() {
  const r = await pool.query('SELECT input_hash, result, created_at FROM ai_cache WHERE id=1');
  return r.rows[0] || null;
}
export async function saveAiCache(hash, result) {
  await pool.query(
    `INSERT INTO ai_cache (id, input_hash, result, created_at) VALUES (1,$1,$2,CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET input_hash=$1, result=$2, created_at=CURRENT_TIMESTAMP`,
    [hash, result]
  );
}

/* ---------------- Platform: rates & settings (ТЗ §2) ---------------- */
export async function getRates() {
  const r = await pool.query('SELECT platform, client_rate::float, creator_rate::float FROM rates ORDER BY platform');
  return r.rows;
}
export async function getSettings() {
  const r = await pool.query('SELECT key, value::float FROM settings');
  return Object.fromEntries(r.rows.map((row) => [row.key, row.value]));
}
export async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [key, value]
  );
  return getSettings();
}
/**
 * Predictive View Calculator — a business enters a budget (and optionally a
 * platform) and gets a view estimate. Views-per-budget is exact (that's the
 * pricing model: client_rate ₸ per real view), the actual estimation is how
 * many videos/creators that budget realistically buys, using our own accepted
 * submissions as the per-video yield — plain computation, no LLM involved.
 */
const MIN_SAMPLE_FOR_OWN_DATA = 3;
export async function getViewEstimate(budget, platform) {
  const rates = await getRates();
  const settings = await getSettings();
  const minViews = settings.min_views_per_video || 2000;
  const platforms = platform ? rates.filter((r) => r.platform === platform) : rates;
  if (!platforms.length) return null;
  const avgQ = await pool.query(
    `SELECT platform, AVG(views)::float AS avg_views, COUNT(*)::int AS n
       FROM submissions WHERE status='accepted' AND views >= $1
       ${platform ? 'AND platform=$2' : ''}
       GROUP BY platform`,
    platform ? [minViews, platform] : [minViews]
  );
  const avgByPlatform = Object.fromEntries(avgQ.rows.map((r) => [r.platform, r]));
  return platforms.map((r) => {
    const stat = avgByPlatform[r.platform];
    const sampleSize = stat?.n || 0;
    const reliable = sampleSize >= MIN_SAMPLE_FOR_OWN_DATA;
    const avgViewsPerVideo = reliable ? stat.avg_views : minViews;
    const totalViews = r.client_rate > 0 ? Math.round(budget / r.client_rate) : 0;
    const estVideos = avgViewsPerVideo > 0 ? Math.max(1, Math.round(totalViews / avgViewsPerVideo)) : 0;
    return {
      platform: r.platform,
      total_views: totalViews,
      est_videos: estVideos,
      avg_views_per_video: Math.round(avgViewsPerVideo),
      basis: reliable ? 'own' : sampleSize > 0 ? 'limited' : 'baseline',
      sample_size: sampleSize,
    };
  });
}

/* ---------------- Platform: creators (ТЗ §3, §4) ---------------- */
/** Blend trust, acceptance ratio and AI quality into a 1–5 star rating. */
export function creatorRating(c) {
  const trust = Math.max(0, Math.min(100, c.trust_score ?? 100)) / 100;
  const done = (c.accepted || 0) + (c.rejected || 0);
  const accRatio = done ? c.accepted / done : null;
  const ai = c.avg_ai ? Math.max(0, Math.min(100, c.avg_ai)) / 100 : null;
  let score;
  if (accRatio == null && ai == null) {
    score = 3 + (trust - 0.5) * 2; // no track record yet → anchor on trust
  } else {
    const parts = [[trust, 0.4]];
    if (accRatio != null) parts.push([accRatio, 0.35]);
    if (ai != null) parts.push([ai, 0.25]);
    const wsum = parts.reduce((a, [, w]) => a + w, 0);
    const val = parts.reduce((a, [v, w]) => a + v * w, 0) / wsum;
    score = 1 + val * 4;
  }
  return Math.round(Math.max(1, Math.min(5, score)) * 2) / 2;
}
export async function listCreators() {
  const settings = await getSettings();
  const minViews = settings.min_views_per_video || 2000;
  // Balance per creator = earned (accepted videos over the min-views threshold ×
  // platform rate) − already-paid payouts — same formula as getCreatorWallet.
  const r = await pool.query(
    `SELECT c.*,
       COALESCE(s.accepted,0)::int AS accepted,
       COALESCE(s.rejected,0)::int AS rejected,
       COALESCE(s.avg_ai,0)::float AS avg_ai,
       COALESCE(earn.earned,0)::float AS earned,
       COALESCE(pay.paid,0)::float AS paid
     FROM creators c
     LEFT JOIN (
       SELECT creator_id,
         COUNT(*) FILTER (WHERE status='accepted') AS accepted,
         COUNT(*) FILTER (WHERE status='rejected') AS rejected,
         AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL) AS avg_ai
       FROM submissions GROUP BY creator_id
     ) s ON s.creator_id = c.id
     LEFT JOIN (
       SELECT s2.creator_id, SUM(s2.views * r.creator_rate) AS earned
       FROM submissions s2 JOIN rates r ON r.platform = s2.platform
       WHERE s2.status='accepted' AND s2.views >= $1
       GROUP BY s2.creator_id
     ) earn ON earn.creator_id = c.id
     LEFT JOIN (
       SELECT creator_id, SUM(amount) AS paid FROM payouts WHERE status='paid' GROUP BY creator_id
     ) pay ON pay.creator_id = c.id
     ORDER BY c.id DESC`,
    [minViews]
  );
  return r.rows.map((row) => ({
    ...row,
    rating: creatorRating(row),
    balance: Math.round((row.earned || 0) - (row.paid || 0)),
  }));
}
export async function getCreator(id) {
  const r = await pool.query('SELECT * FROM creators WHERE id = $1', [id]);
  return r.rows[0] || null;
}
export async function getCreatorByUsername(username) {
  if (!username) return null;
  const r = await pool.query('SELECT * FROM creators WHERE lower(username) = lower($1)', [username]);
  return r.rows[0] || null;
}
/**
 * Public "link in bio" mini-page for a creator (clicki-platform.com/<username>):
 * their name/socials + the brand CTA links from briefs they've completed, most
 * recent first. Grows automatically as the creator accepts more briefs.
 */
export async function getCreatorPublicPage(username) {
  const creator = await getCreatorByUsername(username);
  if (!creator) return null;
  // Show a brand plaque from the moment the creator submits a video for the
  // brief — not only once it's accepted. The gap between submitting and our
  // confirmation (plus views accruing) can be days, and the ref link lives
  // permanently in the creator's bio, so a lead clicking during that window must
  // still see the brand and reach its site. `status <> 'rejected'` covers the
  // whole in-flight lifecycle; a rejected video drops off.
  const r = await pool.query(
    `SELECT b.id, b.title, b.req_cta_link, ba.company, ba.name AS business_name, MAX(s.id) AS recency
       FROM submissions s
       JOIN briefs b ON b.id = s.brief_id
       LEFT JOIN business_accounts ba ON ba.id = b.business_id
      WHERE s.creator_id = $1 AND s.status <> 'rejected' AND b.req_cta_link IS NOT NULL AND b.req_cta_link <> ''
      GROUP BY b.id, b.title, b.req_cta_link, ba.company, ba.name
      ORDER BY recency DESC`,
    [creator.id]
  );
  return {
    id: creator.id,
    name: creator.name,
    socials: creator.socials || '',
    brandLinks: r.rows.map((row) => ({ briefId: row.id, title: row.title, url: row.req_cta_link, brand: row.company || row.business_name || null })),
  };
}
export async function getCreatorByToken(token) {
  if (!token) return null;
  const r = await pool.query(
    'SELECT * FROM creators WHERE session_token = $1 AND session_expires_at > NOW()',
    [token]
  );
  return r.rows[0] || null;
}
// Session expires 30 days out — a leaked/stolen token no longer grants access forever.
export async function setCreatorToken(id, token) {
  await pool.query(
    "UPDATE creators SET session_token = $1, session_expires_at = NOW() + INTERVAL '30 days' WHERE id = $2",
    [token, id]
  );
}
// Operator issues / resets a creator's login credentials from the admin panel.
export async function setCreatorCredentials(id, username, password_hash) {
  const r = await pool.query(
    `UPDATE creators SET username = $1, password_hash = $2, status = 'active' WHERE id = $3 RETURNING *`,
    [username, password_hash, id]
  );
  return r.rows[0] || null;
}
export async function createCreator({ name, email, contact, socials, city, referred_by, username, password_hash, session_token, status }) {
  // Early creators get permanent Founding Creator status (ТЗ §4.5). The cap is a
  // configurable setting (default 50; 0 = unlimited) rather than a hard-coded limit.
  const count = await pool.query('SELECT COUNT(*)::int AS n FROM creators');
  const capRow = await pool.query(`SELECT value::int AS cap FROM settings WHERE key = 'founding_cap'`);
  const cap = capRow.rows[0]?.cap ?? 50;
  const founding = cap === 0 || count.rows[0].n < cap;
  // Retry only on a ugc_code collision (unique-violation 23505); any other error
  // is real and rethrown.
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await pool.query(
        `INSERT INTO creators (name, email, contact, socials, city, referred_by, founding, username, password_hash, session_token, status, ugc_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,'active'),$12) RETURNING *`,
        [name, email || null, contact || null, socials || null, city || null, referred_by || null, founding, username || null, password_hash || null, session_token || null, status || null, generateUgcCode()]
      );
      return r.rows[0];
    } catch (e) {
      if (e.code === '23505' && /ugc_code/.test(e.detail || e.constraint || '') && attempt < 5) continue;
      throw e;
    }
  }
}
export async function updateCreator(id, fields) {
  const allowed = ['account_open', 'onboarding_passed', 'status', 'trust_score', 'avatar_url', 'bio', 'topics', 'city', 'socials', 'email'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in fields) {
      vals.push(fields[k]);
      sets.push(`${k} = $${vals.length}`);
    }
  }
  if (!sets.length) return getCreator(id);
  vals.push(id);
  const r = await pool.query(`UPDATE creators SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return r.rows[0] || null;
}

/* ---------------- OAuth state (CSRF ↔ creator, short-lived) ---------------- */
export async function saveOAuthState(state, creatorId, provider) {
  await pool.query('INSERT INTO oauth_states (state, creator_id, provider) VALUES ($1,$2,$3)', [state, creatorId, provider]);
}
/** One-time use: returns the creator id for a state and deletes it. Null if unknown/expired (>10 min). */
export async function consumeOAuthState(state, provider) {
  const r = await pool.query(
    `DELETE FROM oauth_states WHERE state=$1 AND provider=$2 AND created_at > NOW() - INTERVAL '10 minutes' RETURNING creator_id`,
    [state, provider]
  );
  // Opportunistic cleanup of anything left stale (abandoned flows).
  await pool.query("DELETE FROM oauth_states WHERE created_at <= NOW() - INTERVAL '10 minutes'");
  return r.rows[0]?.creator_id ?? null;
}

/* ---------------- TikTok account connection (Login Kit + Display API) ---------------- */
export async function saveTikTokTokens(creatorId, { open_id, username, access_token, refresh_token, expires_in, refresh_expires_in }) {
  const r = await pool.query(
    `UPDATE creators SET
       tiktok_open_id=$1, tiktok_username=$2, tiktok_access_token=$3, tiktok_refresh_token=$4,
       tiktok_token_expires_at = NOW() + ($5 || ' seconds')::interval,
       tiktok_refresh_expires_at = NOW() + ($6 || ' seconds')::interval
     WHERE id=$7 RETURNING *`,
    [open_id || null, username || null, access_token, refresh_token, expires_in || 0, refresh_expires_in || 0, creatorId]
  );
  return r.rows[0] || null;
}
export async function clearTikTokConnection(creatorId) {
  await pool.query(
    `UPDATE creators SET tiktok_open_id=NULL, tiktok_username=NULL, tiktok_access_token=NULL,
       tiktok_refresh_token=NULL, tiktok_token_expires_at=NULL, tiktok_refresh_expires_at=NULL WHERE id=$1`,
    [creatorId]
  );
}
/** Creators with a live TikTok connection (refresh token not expired) — sync targets. */
/** Creators the TikTok view sync runs for.
 *  The WHERE clause below is mirrored in JS by tiktokSyncing() (tiktok.js), which
 *  is what tells the cabinet it can stop asking a creator for daily screenshots.
 *  Narrow this and someone stops being asked for proof we no longer collect —
 *  keep the two in step. */
export async function listCreatorsWithTikTok() {
  const r = await pool.query(
    `SELECT id, tiktok_open_id, tiktok_username, tiktok_access_token, tiktok_refresh_token,
            tiktok_token_expires_at, tiktok_refresh_expires_at
       FROM creators
      WHERE tiktok_access_token IS NOT NULL AND tiktok_refresh_expires_at > NOW()`
  );
  return r.rows;
}
export async function saveInstagramTokens(creatorId, { user_id, username, access_token, expires_in }) {
  const r = await pool.query(
    `UPDATE creators SET
       ig_user_id=$1, ig_username=$2, ig_access_token=$3,
       ig_token_expires_at = NOW() + ($4 || ' seconds')::interval
     WHERE id=$5 RETURNING *`,
    [user_id || null, username || null, access_token, expires_in || 0, creatorId]
  );
  return r.rows[0] || null;
}
export async function clearInstagramConnection(creatorId) {
  await pool.query(
    `UPDATE creators SET ig_user_id=NULL, ig_username=NULL, ig_access_token=NULL, ig_token_expires_at=NULL WHERE id=$1`,
    [creatorId]
  );
}
export async function listCreatorsWithInstagram() {
  const r = await pool.query(
    `SELECT id, ig_user_id, ig_username, ig_access_token, ig_token_expires_at
       FROM creators
      WHERE ig_access_token IS NOT NULL`
  );
  return r.rows;
}

/* ---------------- Platform: briefs (ТЗ §9) ---------------- */
export async function listBriefs() {
  const r = await pool.query('SELECT * FROM briefs ORDER BY id DESC');
  return r.rows;
}
/** Same list plus who sent it, for the admin moderation queue — an operator
 *  publishing a brief to every creator should see whose brief it is.
 *  Deliberately separate from listBriefs(): that one also feeds the public
 *  /api/demo/admin/briefs, which must not learn real brand names. */
export async function listBriefsForAdmin() {
  const r = await pool.query(
    `SELECT b.*, ba.name AS business_name, ba.company AS business_company,
            (SELECT COUNT(*) FROM assignments a WHERE a.brief_id = b.id)::int AS assigned_count
       FROM briefs b
       LEFT JOIN business_accounts ba ON ba.id = b.business_id
      ORDER BY b.id DESC`
  );
  return r.rows;
}
export async function getBrief(id) {
  const r = await pool.query('SELECT * FROM briefs WHERE id = $1', [id]);
  return r.rows[0] || null;
}
/**
 * Full "who took this brief" analytics for the admin (ТЗ: сколько взяли, кто
 * именно, за какое время, сдал ли). One row per creator who took the brief:
 *   - taken_at            when they took it
 *   - submitted_at        when they first submitted (null = not submitted)
 *   - submission_status   status of that submission
 *   - seconds_to_submit   take → submit duration, in seconds (null if not submitted)
 *   - within_window       still inside their 24h window (the 24-hour rule)
 *   - lapsed              took it, no submission, 24h elapsed → their slot reopened
 * Ordered by take time so the operator reads the sequence they came in.
 */
export async function getBriefTakers(briefId) {
  const r = await pool.query(
    `SELECT
        a.creator_id,
        c.name AS creator_name,
        c.ugc_code,
        a.created_at AS taken_at,
        s.id AS submission_id,
        s.status AS submission_status,
        s.platform AS submission_platform,
        s.video_url,
        s.created_at AS submitted_at,
        (s.created_at IS NOT NULL) AS submitted,
        CASE WHEN s.created_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (s.created_at - a.created_at)) END AS seconds_to_submit,
        (a.created_at > NOW() - INTERVAL '24 hours') AS within_window,
        (s.created_at IS NULL AND a.created_at <= NOW() - INTERVAL '24 hours') AS lapsed
       FROM assignments a
       JOIN creators c ON c.id = a.creator_id
       LEFT JOIN LATERAL (
         SELECT id, status, platform, video_url, created_at
           FROM submissions s2
          WHERE s2.brief_id = a.brief_id AND s2.creator_id = a.creator_id
          ORDER BY s2.created_at ASC
          LIMIT 1
       ) s ON TRUE
      WHERE a.brief_id = $1
      ORDER BY a.created_at ASC`,
    [briefId]
  );
  return r.rows;
}
/** A creator may submit against a brief only if it's still an open broadcast,
 * or they were specifically assigned to it — prevents submitting against an
 * arbitrary brief_id (someone else's, or one still in moderation). */
export async function creatorCanSubmitToBrief(creatorId, briefId) {
  // Holding a slot (assignment) always lets you submit. Otherwise you may submit
  // only to an active brief that is unlimited (slots = 0): a limited brief
  // requires taking a slot first, which is what makes "only these N work on it"
  // hold — a non-holder can't slip a video into a capped brief.
  const r = await pool.query(
    `SELECT 1 FROM briefs b
      WHERE b.id = $2 AND b.status <> 'closed' AND (
        EXISTS (SELECT 1 FROM assignments a WHERE a.brief_id = b.id AND a.creator_id = $1)
        OR (b.status = 'active' AND COALESCE(b.slots, 0) = 0)
      )`,
    [creatorId, briefId]
  );
  return r.rowCount > 0;
}
export async function createBrief(b) {
  // Born as a draft ('new'), NOT live. Previously this hardcoded 'active', so a
  // brief was public to every creator the instant "Создать бриф" was clicked —
  // there was no moment to assign it to a chosen few first. The operator now
  // decides after creating: "Опубликовать всем" or "Назначить выбранным". Only an
  // explicit status:'active' from the caller publishes on create.
  const status = b.status === 'active' ? 'active' : 'new';
  const r = await pool.query(
    `INSERT INTO briefs
      (title, goal, audience, key_message, platform, duration_min, duration_max,
       req_hashtag, req_mention, req_cta_link, dos, donts, tone, refs, slots, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [
      b.title, b.goal || null, b.audience || null, b.key_message || null, b.platform,
      b.duration_min || 15, b.duration_max || 90, b.req_hashtag || null, !!b.req_mention,
      b.req_cta_link || null, b.dos || null, b.donts || null, b.tone || null, b.refs || null, b.slots || 0,
      status,
    ]
  );
  return r.rows[0];
}
export async function setBriefStatus(id, status) {
  const r = await pool.query('UPDATE briefs SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
  return r.rows[0] || null;
}
/**
 * Delete a brief. Safe by schema: submissions.brief_id is ON DELETE SET NULL
 * (a creator's already-submitted videos survive, just detached) and assignments
 * cascade away. Returns true if a row was removed.
 */
export async function deleteBrief(id) {
  const r = await pool.query('DELETE FROM briefs WHERE id = $1', [id]);
  return r.rowCount > 0;
}
export async function setBriefAi(id, { ai_score, ai_feedback }) {
  const r = await pool.query('UPDATE briefs SET ai_score = $1, ai_feedback = $2 WHERE id = $3 RETURNING *', [ai_score, ai_feedback || null, id]);
  return r.rows[0] || null;
}
/** Return a brief to the business for fixes (moderation step). */
export async function setBriefRevision(id, note) {
  const r = await pool.query(
    "UPDATE briefs SET status = 'revision', revision_note = $1 WHERE id = $2 RETURNING *",
    [note || null, id]
  );
  return r.rows[0] || null;
}
/** Business edits its own brief and resubmits → back to moderation ('new'). */
export async function updateBusinessBrief(id, businessId, b) {
  const r = await pool.query(
    `UPDATE briefs SET title=$1, platform=$2, key_message=$3, req_hashtag=$4,
        duration_max=$5, tone=$6, spec=$7, req_cta_link=$8, dos=$9, donts=$10,
        status='new', revision_note=NULL, ai_score=NULL, ai_feedback=NULL
      WHERE id=$11 AND business_id=$12 AND status IN ('new','revision') RETURNING *`,
    [
      b.title, b.platform || 'TikTok', b.key_message || null, b.req_hashtag || null,
      b.duration_max || 90, b.tone || null, JSON.stringify(b.spec || {}), b.req_cta_link || null,
      b.dos || null, b.donts || null, id, businessId,
    ]
  );
  return r.rows[0] || null;
}
/** Operator edits a brief's content in place. Unlike updateBusinessBrief this does
 *  NOT touch status/moderation — so the change is live for creators immediately
 *  (an active/assigned brief stays active/assigned, just with new content). */
export async function adminUpdateBrief(id, b) {
  const r = await pool.query(
    `UPDATE briefs SET title=$1, platform=$2, key_message=$3, req_hashtag=$4,
        duration_max=$5, tone=$6, spec=$7, req_cta_link=$8, dos=$9, donts=$10
      WHERE id=$11 RETURNING *`,
    [
      b.title, b.platform || 'TikTok', b.key_message || null, b.req_hashtag || null,
      b.duration_max || 90, b.tone || null, JSON.stringify(b.spec || {}), b.req_cta_link || null,
      b.dos || null, b.donts || null, id,
    ]
  );
  return r.rows[0] || null;
}
export async function assignBrief(briefId, creatorId) {
  const r = await pool.query(
    `INSERT INTO assignments (brief_id, creator_id) VALUES ($1,$2)
     ON CONFLICT (brief_id, creator_id) DO NOTHING RETURNING *`,
    [briefId, creatorId]
  );
  return r.rows[0] || null;
}

/**
 * A creator takes an open brief, reserving one of its slots. When slots > 0 the
 * brief closes to everyone else once that many creators have taken it; slots = 0
 * (or null) means unlimited — the old behaviour, unchanged.
 *
 * The count-then-insert runs inside a transaction under a per-brief advisory
 * lock, so two creators racing for the last slot can't both get in — without it
 * a 10-slot brief could hand out 11+. Returns:
 *   { ok:true }            slot reserved
 *   { ok:true, already }   they already held a slot (idempotent)
 *   { ok:false, reason }   'unavailable' (not active) | 'full' (no slots left)
 */
export async function takeBrief(briefId, creatorId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(88, $1)', [briefId]); // 88 = "brief take"
    const brief = (await client.query('SELECT status, slots FROM briefs WHERE id=$1', [briefId])).rows[0];
    if (!brief || brief.status !== 'active') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'unavailable' };
    }
    const mine = await client.query('SELECT 1 FROM assignments WHERE brief_id=$1 AND creator_id=$2', [briefId, creatorId]);
    if (mine.rowCount) {
      await client.query('COMMIT');
      return { ok: true, already: true };
    }
    const slots = Number(brief.slots) || 0;
    if (slots > 0) {
      // Count only creators still holding a slot (24-hour rule) — lapsed holders
      // don't occupy a slot, so their spot is available to take.
      const taken = (await client.query(
        `SELECT COUNT(*)::int AS n FROM assignments a WHERE a.brief_id=$1 AND ${ACTIVE_HOLDER_SQL}`,
        [briefId]
      )).rows[0].n;
      if (taken >= slots) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'full' };
      }
    }
    await client.query('INSERT INTO assignments (brief_id, creator_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [briefId, creatorId]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Assign one brief to several creators at once. Returns how many assignments were
 * actually created versus asked for — re-picking someone already assigned is a
 * no-op (ON CONFLICT), so `assigned` can be less than `requested`, which the
 * caller reports honestly ("3 назначено, 2 уже были").
 */
export async function assignBriefMany(briefId, creatorIds) {
  const ids = [...new Set((creatorIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return { assigned: 0, requested: 0 };
  const r = await pool.query(
    `INSERT INTO assignments (brief_id, creator_id)
     SELECT $1, x FROM unnest($2::int[]) AS x
     ON CONFLICT (brief_id, creator_id) DO NOTHING`,
    [briefId, ids]
  );
  return { assigned: r.rowCount, requested: ids.length };
}
/** Remove a creator's assignment to a brief — revokes their access to work on it
 *  (afterwards they can't submit unless the brief is an open, unlimited order).
 *  Their past submissions are untouched. Returns how many rows were removed. */
export async function unassignBrief(briefId, creatorId) {
  const r = await pool.query('DELETE FROM assignments WHERE brief_id=$1 AND creator_id=$2', [briefId, creatorId]);
  return r.rowCount;
}
/** Creator ids assigned to a brief — used to notify takers when it's closed. */
export async function listBriefAssignedCreatorIds(briefId) {
  const r = await pool.query('SELECT creator_id FROM assignments WHERE brief_id = $1', [briefId]);
  return r.rows.map((row) => row.creator_id);
}
export async function listAssignmentsForCreator(creatorId) {
  const r = await pool.query(
    `SELECT a.*, b.title, b.platform, b.req_hashtag, b.req_mention, b.req_cta_link,
            b.goal, b.audience, b.key_message, b.duration_min, b.duration_max,
            b.dos, b.donts, b.tone, b.refs, b.spec, b.status AS brief_status
       FROM assignments a JOIN briefs b ON b.id = a.brief_id
      WHERE a.creator_id = $1 ORDER BY a.id DESC`,
    [creatorId]
  );
  return r.rows;
}

/* ---------------- Platform: business accounts + their briefs ---------------- */
export async function createBusiness({ name, email, company, contact, password_hash }) {
  const r = await pool.query(
    `INSERT INTO business_accounts (name, email, company, contact, password_hash)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, email, company || null, contact || null, password_hash]
  );
  return r.rows[0];
}
export async function getBusinessByEmail(email) {
  if (!email) return null;
  const r = await pool.query('SELECT * FROM business_accounts WHERE lower(email) = lower($1)', [email]);
  return r.rows[0] || null;
}
export async function getBusinessByToken(token) {
  if (!token) return null;
  const r = await pool.query(
    'SELECT * FROM business_accounts WHERE session_token = $1 AND session_expires_at > NOW()',
    [token]
  );
  return r.rows[0] || null;
}
export async function getBusiness(id) {
  const r = await pool.query('SELECT * FROM business_accounts WHERE id = $1', [id]);
  return r.rows[0] || null;
}
// Self-service profile edits from the business "My account" screen (whitelisted).
export async function updateBusiness(id, fields) {
  const allowed = ['name', 'company', 'logo_url', 'contact'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in fields) {
      vals.push(fields[k]);
      sets.push(`${k} = $${vals.length}`);
    }
  }
  if (!sets.length) return getBusiness(id);
  vals.push(id);
  const r = await pool.query(`UPDATE business_accounts SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return r.rows[0] || null;
}
// Session expires 30 days out — a leaked/stolen token no longer grants access forever.
export async function setBusinessToken(id, token) {
  await pool.query(
    "UPDATE business_accounts SET session_token = $1, session_expires_at = NOW() + INTERVAL '30 days' WHERE id = $2",
    [token, id]
  );
}
export async function listBusinessBriefs(businessId) {
  const r = await pool.query('SELECT * FROM briefs WHERE business_id = $1 ORDER BY id DESC', [businessId]);
  return r.rows;
}
export async function createBusinessBrief(businessId, b) {
  const r = await pool.query(
    `INSERT INTO briefs
      (title, goal, audience, key_message, platform, duration_min, duration_max,
       req_hashtag, req_mention, req_cta_link, dos, donts, tone, refs, slots, status, business_id, spec)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'new',$16,$17) RETURNING *`,
    [
      b.title, b.goal || null, b.audience || null, b.key_message || null, b.platform || 'TikTok',
      b.duration_min || 15, b.duration_max || 90, b.req_hashtag || null, !!b.req_mention,
      b.req_cta_link || null, b.dos || null, b.donts || null, b.tone || null, b.refs || null,
      b.slots || 0, businessId, JSON.stringify(b.spec || {}),
    ]
  );
  return r.rows[0];
}
// Admin: list all business accounts (never expose password_hash / session_token).
export async function listBusinesses() {
  const r = await pool.query(
    `SELECT b.id, b.name, b.email, b.company, b.contact, b.created_at,
            (SELECT COUNT(*) FROM briefs WHERE business_id = b.id)::int AS briefs
       FROM business_accounts b
       ORDER BY b.id DESC`
  );
  return r.rows;
}
// Admin: reset a business's email/password (also drops any live session).
export async function setBusinessCredentials(id, email, password_hash) {
  const r = await pool.query(
    `UPDATE business_accounts
        SET email = $2, password_hash = $3, session_token = NULL
      WHERE id = $1 RETURNING id, name, email, company, created_at`,
    [id, email, password_hash]
  );
  return r.rows[0] || null;
}
// Admin: delete a business account (its briefs keep, business_id → NULL per schema).
export async function deleteBusiness(id) {
  const r = await pool.query('DELETE FROM business_accounts WHERE id = $1 RETURNING id', [id]);
  return r.rowCount > 0;
}
// Admin: delete a creator. Submissions/assignments/payouts/screenshots cascade
// per schema; first detach anyone this creator referred so the self-referencing
// referred_by FK doesn't block the delete.
export async function deleteCreator(id) {
  await pool.query('UPDATE creators SET referred_by = NULL WHERE referred_by = $1', [id]);
  const r = await pool.query('DELETE FROM creators WHERE id = $1 RETURNING id', [id]);
  return r.rowCount > 0;
}
// Ban a creator until `until` (a Date), or permanently when until is null.
export async function setCreatorBan(id, until) {
  const r = await pool.query(
    "UPDATE creators SET status = 'banned', banned_until = $2 WHERE id = $1 RETURNING *",
    [id, until]
  );
  return r.rows[0] || null;
}
export async function unbanCreator(id) {
  const r = await pool.query(
    "UPDATE creators SET status = 'active', banned_until = NULL WHERE id = $1 RETURNING *",
    [id]
  );
  return r.rows[0] || null;
}
/**
 * Danger zone: wipe all account + transactional data for a clean slate.
 * Keeps site content (site_content/media/videos) and config (settings/rates).
 * The admin account lives in env, not the DB, so it is never affected.
 */
export async function resetPlatformData() {
  await pool.query(`TRUNCATE TABLE
    submissions, assignments, payouts, referral_leads, submission_decisions,
    view_snapshots, oauth_states, visits, ai_cache, briefs, creators, business_accounts
    RESTART IDENTITY CASCADE`);
}

/* ---------------- Platform: submissions & review (ТЗ §3, §9) ---------------- */
export async function createSubmission(s) {
  const r = await pool.query(
    `INSERT INTO submissions
      (brief_id, creator_id, platform, video_url, published_at, screenshot_url, rights_confirmed, checklist)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      s.brief_id || null, s.creator_id, s.platform, s.video_url, s.published_at || null,
      s.screenshot_url || null, !!s.rights_confirmed, s.checklist ? JSON.stringify(s.checklist) : null,
    ]
  );
  return r.rows[0];
}
export async function listSubmissions(status) {
  const where = status ? 'WHERE s.status = $1' : '';
  const params = status ? [status] : [];
  const r = await pool.query(
    `SELECT s.*, c.name AS creator_name, b.title AS brief_title,
            b.req_hashtag, b.req_mention, b.req_cta_link, b.duration_min, b.duration_max,
            COALESCE(ss.cnt, 0)::int AS screenshots_count, ss.last_at AS last_screenshot_at
       FROM submissions s
       LEFT JOIN creators c ON c.id = s.creator_id
       LEFT JOIN briefs b ON b.id = s.brief_id
       LEFT JOIN (
         SELECT submission_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
           FROM stat_screenshots GROUP BY submission_id
       ) ss ON ss.submission_id = s.id
       ${where} ORDER BY s.id DESC`,
    params
  );
  const fraud = await getFraudSignals();
  // Batched (not per-row) view-history fetch — powers the live sparkline in the
  // admin review queue so an operator can see each video's growth at a glance.
  const ids = r.rows.map((row) => row.id);
  const historyRows = ids.length
    ? await pool.query(
        `SELECT submission_id, views, to_char(recorded_at,'YYYY-MM-DD HH24:MI') AS at
           FROM view_snapshots WHERE submission_id = ANY($1::int[]) ORDER BY submission_id, recorded_at`,
        [ids]
      )
    : { rows: [] };
  const historyBySub = new Map();
  for (const row of historyRows.rows) {
    if (!historyBySub.has(row.submission_id)) historyBySub.set(row.submission_id, []);
    historyBySub.get(row.submission_id).push({ views: row.views, at: row.at });
  }
  return r.rows.map((row) => ({ ...row, fraud: fraud[row.id] || null, views_history: historyBySub.get(row.id) || [] }));
}
export async function listCreatorSubmissions(creatorId) {
  const r = await pool.query(
    `SELECT s.*, b.title AS brief_title,
            COALESCE(ss.cnt, 0)::int AS screenshots_count,
            ss.last_at AS last_screenshot_at,
            (ss.last_day = CURRENT_DATE) AS screenshot_today
       FROM submissions s
       LEFT JOIN briefs b ON b.id = s.brief_id
       LEFT JOIN (
         SELECT submission_id, COUNT(*) AS cnt, MAX(created_at) AS last_at, MAX(day_key) AS last_day
           FROM stat_screenshots GROUP BY submission_id
       ) ss ON ss.submission_id = s.id
      WHERE s.creator_id = $1 ORDER BY s.id DESC`,
    [creatorId]
  );
  return r.rows;
}
export async function getSubmission(id) {
  const r = await pool.query('SELECT * FROM submissions WHERE id = $1', [id]);
  return r.rows[0] || null;
}

/* ---------------- Daily stats screenshots ---------------- */
export async function addStatScreenshot(submissionId, creatorId, url) {
  const r = await pool.query(
    'INSERT INTO stat_screenshots (submission_id, creator_id, url) VALUES ($1,$2,$3) RETURNING id, url, day_key, created_at',
    [submissionId, creatorId, url]
  );
  return r.rows[0];
}
/** Timestamp (ms) of the most recent screenshot for a submission, or null. */
export async function getLastScreenshotAt(submissionId) {
  const r = await pool.query('SELECT created_at FROM stat_screenshots WHERE submission_id = $1 ORDER BY created_at DESC LIMIT 1', [submissionId]);
  return r.rows[0] ? new Date(r.rows[0].created_at).getTime() : null;
}

/** All screenshots for a submission, newest first. */
export async function listStatScreenshots(submissionId) {
  const r = await pool.query(
    "SELECT id, url, day_key, to_char(created_at,'YYYY-MM-DD HH24:MI') AS at FROM stat_screenshots WHERE submission_id = $1 ORDER BY created_at DESC",
    [submissionId]
  );
  return r.rows;
}
/* Pipeline transitions (steps 7-12) */
export async function setSubmissionAi(id, { ai_score, ai_feedback, status }) {
  const r = await pool.query(
    'UPDATE submissions SET ai_score = $1, ai_feedback = $2, status = $3 WHERE id = $4 RETURNING *',
    [ai_score, ai_feedback || null, status, id]
  );
  return r.rows[0] || null;
}
/** Operator sends a video to the business — guarded so an already-accepted or
 * -rejected submission can't be re-queued (that re-opened it to a second
 * business accept → a second payout). Returns null if the transition wasn't valid. */
export async function sendSubmissionToBusiness(id, checklist) {
  const r = await pool.query(
    `UPDATE submissions SET status='sent_to_business',
        checklist = COALESCE($2, checklist)
      WHERE id=$1 AND status NOT IN ('accepted','rejected') RETURNING *`,
    [id, checklist ? JSON.stringify(checklist) : null]
  );
  return r.rows[0] || null;
}
/* All published orders — a published brief is open to every creator (broadcast) */
export async function listActiveBriefs() {
  const r = await pool.query("SELECT * FROM briefs WHERE status = 'active' ORDER BY id DESC");
  return r.rows;
}
/**
 * Smart Brief Matching — same broadcast list every creator can see, but sorted
 * by what it's likely worth to THIS creator: their own average views on that
 * platform (falling back to the platform-wide average, then a flat baseline)
 * times the platform's payout rate. No LLM call — payout ranking has to be
 * accurate, not generative.
 */
const MIN_SAMPLE_FOR_OWN_CREATOR_DATA = 2;
export async function listActiveBriefsRanked(creatorId) {
  const briefs = await listActiveBriefs();
  if (!briefs.length) return briefs;
  const settings = await getSettings();
  const minViews = settings.min_views_per_video || 2000;
  const [ratesQ, ownAvgQ, marketAvgQ, countsQ, mineQ] = await Promise.all([
    pool.query('SELECT platform, creator_rate FROM rates'),
    pool.query(
      `SELECT platform, AVG(views)::float AS avg_views, COUNT(*)::int AS n FROM submissions
        WHERE creator_id=$1 AND status='accepted' AND views >= $2
        GROUP BY platform`,
      [creatorId, minViews]
    ),
    pool.query(
      `SELECT platform, AVG(views)::float AS avg_views FROM submissions
        WHERE status='accepted' AND views >= $1
        GROUP BY platform`,
      [minViews]
    ),
    // Only holders still occupying a slot (24-hour rule) count toward "full".
    pool.query(`SELECT a.brief_id, COUNT(*)::int AS n FROM assignments a WHERE ${ACTIVE_HOLDER_SQL} GROUP BY a.brief_id`),
    pool.query('SELECT brief_id FROM assignments WHERE creator_id=$1', [creatorId]),
  ]);
  const rateByPlatform = Object.fromEntries(ratesQ.rows.map((r) => [r.platform, Number(r.creator_rate)]));
  const ownByPlatform = Object.fromEntries(ownAvgQ.rows.map((r) => [r.platform, r]));
  const marketAvgByPlatform = Object.fromEntries(marketAvgQ.rows.map((r) => [r.platform, r.avg_views]));
  const takenByBrief = Object.fromEntries(countsQ.rows.map((r) => [r.brief_id, r.n]));
  const mine = new Set(mineQ.rows.map((r) => r.brief_id));
  const ranked = briefs
    // Drop briefs this creator already took (they show under "Назначенные тебе")
    // and limited briefs that are already full — those are closed to newcomers.
    .filter((b) => {
      if (mine.has(b.id)) return false;
      const slots = Number(b.slots) || 0;
      return slots === 0 || (takenByBrief[b.id] || 0) < slots;
    })
    .map((b) => {
      const rate = rateByPlatform[b.platform] || 0;
      const own = ownByPlatform[b.platform];
      const ownReliable = own && own.n >= MIN_SAMPLE_FOR_OWN_CREATOR_DATA;
      const avgViews = ownReliable ? own.avg_views : marketAvgByPlatform[b.platform] || minViews;
      const slots = Number(b.slots) || 0;
      return {
        ...b,
        est_payout: Math.round(avgViews * rate),
        est_basis: ownReliable ? 'own' : marketAvgByPlatform[b.platform] ? 'market' : 'baseline',
        est_sample_size: own?.n || 0,
        // slots_left = null when unlimited; a number the creator can see counting down.
        slots_left: slots > 0 ? Math.max(0, slots - (takenByBrief[b.id] || 0)) : null,
      };
    });
  ranked.sort((a, b) => b.est_payout - a.est_payout);
  return ranked;
}
/* Published orders a creator hasn't taken yet (optional bookmark) */
export async function listOpenBriefsForCreator(creatorId) {
  const r = await pool.query(
    `SELECT b.* FROM briefs b
      WHERE b.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.brief_id = b.id AND a.creator_id = $1)
      ORDER BY b.id DESC`,
    [creatorId]
  );
  return r.rows;
}
/* Submissions awaiting / done business acceptance (steps 11-12) */
export async function listBusinessSubmissions(businessId) {
  const r = await pool.query(
    `SELECT s.*, c.name AS creator_name, b.title AS brief_title
       FROM submissions s
       JOIN briefs b ON b.id = s.brief_id
       LEFT JOIN creators c ON c.id = s.creator_id
      WHERE b.business_id = $1 AND s.status IN ('sent_to_business', 'accepted')
      ORDER BY s.id DESC`,
    [businessId]
  );
  return r.rows;
}
/**
 * Business accepts a submission — one atomic, conditional UPDATE instead of a
 * separate read-then-write, so two concurrent accept calls (a double-click, or
 * the operator re-sending an already-accepted video) can't both succeed and
 * each trigger their own payout. Only the request that actually flips
 * sent_to_business → accepted gets a non-null row back.
 */
/**
 * Operator makes the final acceptance — the business no longer does. Accepts a
 * submission that is either through AI ('ai_passed') or already waiting in the
 * legacy 'sent_to_business' queue, so this also drains work that was in flight
 * when acceptance moved to the operator. Same conditional-UPDATE shape as the
 * business path: a double-click can win only once, so the caller can't queue a
 * second payout for the same video. Mirrors the accrual (streak/XP/referral).
 */
export async function acceptSubmissionByOperator(submissionId) {
  const r = await pool.query(
    `UPDATE submissions SET status='accepted', reviewed_at=CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('ai_passed', 'sent_to_business')
      RETURNING *`,
    [submissionId]
  );
  const sub = r.rows[0] || null;
  if (sub) {
    await logSubmissionDecision(sub, 'accepted', null);
    await applyStreak(sub.creator_id);
    await recomputeXp(sub.creator_id);
    await handleReferralFirstAccept(sub.creator_id);
  }
  return sub;
}
/* ---- Gamification accrual (ТЗ §4) ---- */
// XP = function of accumulated accepted views, plus any bonus XP earned outside
// that formula (referrals etc.) so bonuses aren't wiped out on the next accept (ТЗ §4.3)
async function recomputeXp(creatorId) {
  await pool.query(
    `UPDATE creators SET xp =
       (SELECT FLOOR(COALESCE(SUM(views),0)/100) FROM submissions WHERE creator_id=$1 AND status='accepted')
       + bonus_xp
     WHERE id=$1`,
    [creatorId]
  );
}
// Streak: +1 per day with an accepted video; gap consumes a freeze-token or resets (ТЗ §4.1)
async function applyStreak(creatorId) {
  const c = (await pool.query('SELECT streak, freeze_tokens, last_streak_date FROM creators WHERE id=$1', [creatorId])).rows[0];
  if (!c) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = c.streak;
  let freeze = c.freeze_tokens;
  if (c.last_streak_date) {
    const last = new Date(c.last_streak_date);
    last.setHours(0, 0, 0, 0);
    const diff = Math.round((today - last) / 86400000);
    if (diff === 0) return; // already counted today
    if (diff === 1) streak += 1;
    else if (freeze > 0) {
      freeze -= 1;
      streak += 1;
    } else streak = 1;
  } else {
    streak = 1;
  }
  await pool.query('UPDATE creators SET streak=$1, freeze_tokens=$2, last_streak_date=CURRENT_DATE WHERE id=$3', [streak, freeze, creatorId]);
}
// Referral bonus on the referred creator's FIRST accepted video (ТЗ §4.5)
// XP the inviter earns when a creator they referred gets their first video
// accepted. One constant so the accrual and the analytics can't drift apart.
const FRIEND_REFERRAL_XP = 500;
async function handleReferralFirstAccept(creatorId) {
  const c = (await pool.query('SELECT referred_by, referral_qualified FROM creators WHERE id=$1', [creatorId])).rows[0];
  if (!c || !c.referred_by || c.referral_qualified) return;
  const n = (await pool.query(`SELECT COUNT(*)::int AS n FROM submissions WHERE creator_id=$1 AND status='accepted'`, [creatorId])).rows[0].n;
  if (n === 1) {
    await pool.query('UPDATE creators SET referral_qualified=TRUE WHERE id=$1', [creatorId]);
    await pool.query('UPDATE creators SET xp = xp + $1, bonus_xp = bonus_xp + $1 WHERE id=$2', [FRIEND_REFERRAL_XP, c.referred_by]);
  }
}

// XP awarded per business lead that arrives through a creator's public referral
// link (distinct from the creator-invites-creator bonus above).
const REFERRAL_LEAD_XP = 30;
/** Record a lead attributed to a creator's referral link and grant the XP bonus. */
export async function recordReferralLead(creatorId, funnel) {
  const creator = await getCreator(creatorId);
  if (!creator) return null;
  await pool.query('INSERT INTO referral_leads (creator_id, funnel) VALUES ($1,$2)', [creatorId, funnel]);
  await pool.query(
    'UPDATE creators SET xp = xp + $1, bonus_xp = bonus_xp + $1 WHERE id = $2',
    [REFERRAL_LEAD_XP, creatorId]
  );
  return { creatorId, xpAwarded: REFERRAL_LEAD_XP };
}
/** Per-creator + total counts of leads brought in via referral links (admin analytics). */
export async function getReferralLeadStats() {
  const totalQ = await pool.query('SELECT COUNT(*)::int AS n FROM referral_leads');
  const byCreator = await pool.query(
    `SELECT c.id, c.name, c.username, COUNT(rl.id)::int AS leads
       FROM referral_leads rl JOIN creators c ON c.id = rl.creator_id
      GROUP BY c.id ORDER BY leads DESC`
  );
  return { total: totalQ.rows[0].n, xpPerLead: REFERRAL_LEAD_XP, byCreator: byCreator.rows };
}
/** A creator's own referral performance — leads/clients brought in via their link, with dates. */
export async function getReferralLeadsForCreator(creatorId) {
  const [leadsQ, clicksQ, friendsQ] = await Promise.all([
    pool.query(
      `SELECT id, funnel, to_char(created_at,'YYYY-MM-DD HH24:MI') AS at
         FROM referral_leads WHERE creator_id=$1 ORDER BY created_at DESC`,
      [creatorId]
    ),
    pool.query('SELECT COUNT(*)::int AS people FROM ref_visits WHERE creator_id=$1', [creatorId]),
    // Friend-referral outcomes — invited creators and how many have "qualified"
    // (their first video accepted, which is what pays the inviter). This data
    // always existed on creators.referred_by / referral_qualified; it just was
    // never surfaced, so the friend link looked like it counted nothing.
    pool.query(
      `SELECT COUNT(*)::int AS invited,
              COUNT(*) FILTER (WHERE referral_qualified)::int AS qualified
         FROM creators WHERE referred_by = $1`,
      [creatorId]
    ),
  ]);
  const clicks = clicksQ.rows[0].people;
  const leadCount = leadsQ.rowCount;
  const friends = friendsQ.rows[0];
  return {
    total: leadCount,
    xpPerLead: REFERRAL_LEAD_XP,
    leads: leadsQ.rows,
    clicks, // unique people who opened the bio/ref link
    // Simple funnel read for the cabinet: what share of clicks turned into leads.
    conversion: clicks ? Math.round((leadCount / clicks) * 100) : null,
    // Friend link: invited → qualified (first video accepted) → XP actually earned.
    friends: {
      invited: friends.invited,
      qualified: friends.qualified,
      xpPerFriend: FRIEND_REFERRAL_XP,
      xpEarned: friends.qualified * FRIEND_REFERRAL_XP,
    },
  };
}

/** Count one click on a creator's ref/bio link, deduped per visitor per day. */
export async function recordRefVisit(creatorId, visitor) {
  if (!creatorId || !visitor) return;
  await pool.query(
    'INSERT INTO ref_visits (creator_id, visitor) VALUES ($1, $2) ON CONFLICT (creator_id, visitor, day_key) DO NOTHING',
    [creatorId, visitor]
  );
}

/** Count one lead click-through from a creator's page to a brand's site, deduped
 *  per visitor per day. Attributed to the brief (→ business) and the creator. */
export async function recordBrandClick(briefId, creatorId, visitor) {
  if (!briefId || !creatorId || !visitor) return;
  await pool.query(
    'INSERT INTO brand_clicks (brief_id, creator_id, visitor) VALUES ($1, $2, $3) ON CONFLICT (brief_id, creator_id, visitor, day_key) DO NOTHING',
    [briefId, creatorId, visitor]
  );
}

/**
 * Monthly report: for the given calendar month, per creator — how many leads/
 * clients came in through their referral link, and how many views their
 * accepted videos earned. Defaults to the current month.
 */
export async function getMonthlyReport(year, month) {
  const y = year || new Date().getFullYear();
  const m = month || new Date().getMonth() + 1;
  const r = await pool.query(
    `SELECT c.id, c.name, c.username,
            COALESCE(rl.leads, 0)::int AS leads,
            COALESCE(sv.views, 0)::int AS views
       FROM creators c
       LEFT JOIN (
         SELECT creator_id, COUNT(*)::int AS leads
           FROM referral_leads
          WHERE date_trunc('month', created_at) = make_date($1, $2, 1)
          GROUP BY creator_id
       ) rl ON rl.creator_id = c.id
       LEFT JOIN (
         SELECT creator_id, SUM(views)::int AS views
           FROM submissions
          WHERE status = 'accepted' AND date_trunc('month', reviewed_at) = make_date($1, $2, 1)
          GROUP BY creator_id
       ) sv ON sv.creator_id = c.id
      WHERE COALESCE(rl.leads, 0) > 0 OR COALESCE(sv.views, 0) > 0
      ORDER BY views DESC, leads DESC`,
    [y, m]
  );
  return { year: y, month: m, rows: r.rows };
}

export function levelFromXp(xp) {
  if (xp >= 15000) return 'Legend';
  if (xp >= 5000) return 'Elite';
  if (xp >= 2000) return 'Pro Creator';
  if (xp >= 500) return 'Rising Star';
  return 'Rookie';
}

export async function getLeaderboard() {
  const r = await pool.query(
    `SELECT id, name, xp, streak, founding FROM creators WHERE status='active' ORDER BY xp DESC, streak DESC LIMIT 30`
  );
  return r.rows.map((row) => ({ ...row, level: levelFromXp(row.xp) }));
}

// Decision journal (foundation for future AI, not AI itself): one row per
// accept/reject/rework call, independent of what happens to the submission next.
async function logSubmissionDecision(sub, status, reject_code) {
  const secondsToDecision = sub.created_at
    ? Math.max(0, Math.round((Date.now() - new Date(sub.created_at).getTime()) / 1000))
    : null;
  await pool.query(
    `INSERT INTO submission_decisions (submission_id, creator_id, brief_id, status, reject_code, views_at_decision, seconds_to_decision)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [sub.id, sub.creator_id, sub.brief_id, status, reject_code || null, sub.views || 0, secondsToDecision]
  );
}
/** Recent decisions for admin review — the raw journal, most recent first. */
export async function listDecisionJournal(limit = 100) {
  const r = await pool.query(
    `SELECT d.*, c.name AS creator_name, b.title AS brief_title
       FROM submission_decisions d
       LEFT JOIN creators c ON c.id = d.creator_id
       LEFT JOIN briefs b ON b.id = d.brief_id
      ORDER BY d.id DESC LIMIT $1`,
    [limit]
  );
  return r.rows;
}

/** Operator review (ТЗ §3.5, §9.2). Acceptance drives streak/XP + referral. */
export async function reviewSubmission(id, { status, reject_code, checklist }) {
  const r = await pool.query(
    `UPDATE submissions SET status=$1, reject_code=$2,
        checklist = COALESCE($3, checklist), reviewed_at = CURRENT_TIMESTAMP
      WHERE id=$4 RETURNING *`,
    [status, reject_code || null, checklist ? JSON.stringify(checklist) : null, id]
  );
  const sub = r.rows[0] || null;
  if (sub) {
    await logSubmissionDecision(sub, status, reject_code);
    if (status === 'accepted') {
      await applyStreak(sub.creator_id);
      await recomputeXp(sub.creator_id);
      await handleReferralFirstAccept(sub.creator_id);
    } else if (status === 'rejected' || status === 'rework') {
      await cancelPendingPayout(id); // don't leave a payable payout on a non-accepted video
    }
  }
  return sub;
}
export async function setCoachFeedback(id, feedback) {
  const r = await pool.query('UPDATE submissions SET coach_feedback = $1 WHERE id = $2 RETURNING *', [feedback, id]);
  return r.rows[0] || null;
}
/** Admin override: change a submission's status even after a decision (e.g. undo an
 *  accidental rejection → back to review/at-business) and/or set a written reason.
 *  `note === undefined` leaves the existing note untouched. Re-accepting recomputes XP. */
export async function overrideSubmissionStatus(id, status, note) {
  const r = await pool.query(
    `UPDATE submissions
        SET status = $1,
            review_note = CASE WHEN $2::text IS NULL THEN review_note ELSE $2 END,
            reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $3 RETURNING *`,
    [status, note ?? null, id]
  );
  const sub = r.rows[0] || null;
  if (sub) {
    await logSubmissionDecision(sub, status, sub.reject_code);
    if (status === 'accepted') await recomputeXp(sub.creator_id);
    else await cancelPendingPayout(id); // left 'accepted' → void any still-unpaid payout
  }
  return sub;
}
/** Manual view entry (ТЗ §9). final = 30-day window check done. Recomputes XP.
 *  Also appends a snapshot — the single `views` column only ever holds the
 *  latest reading, this is the history behind it (anti-fraud + growth chart). */
export async function recordViews(id, views, final) {
  // Never store a negative count — a stray minus (or a glitched API 0/null) must
  // not push earnings/XP below zero. Views are whole numbers.
  const v = Math.max(0, Math.round(Number(views) || 0));
  const r = await pool.query('UPDATE submissions SET views=$1, views_final=$2 WHERE id=$3 RETURNING *', [v, !!final, id]);
  const sub = r.rows[0] || null;
  if (sub) {
    await pool.query('INSERT INTO view_snapshots (submission_id, views) VALUES ($1,$2)', [id, v]);
    await recomputeXp(sub.creator_id);
  }
  return sub;
}

/**
 * AI anti-fraud signal: not "catching the fraudster" — flagging a strange
 * pattern in the numbers for a human to look at. From consecutive view
 * snapshots, computes the hourly growth rate between each pair; flags a
 * submission if that rate is either implausibly fast (a spike) or implausibly
 * smooth (near-constant rate, which organic reach rarely produces).
 * Thresholds live in `settings` so they can be tuned as real data comes in.
 */
export async function getFraudSignals() {
  const r = await pool.query(`
    WITH ordered AS (
      SELECT submission_id, views, recorded_at,
             LAG(views) OVER (PARTITION BY submission_id ORDER BY recorded_at) AS prev_views,
             LAG(recorded_at) OVER (PARTITION BY submission_id ORDER BY recorded_at) AS prev_at
      FROM view_snapshots
    ),
    rates AS (
      SELECT submission_id,
             (views - prev_views)::float AS dv,
             EXTRACT(EPOCH FROM (recorded_at - prev_at)) / 3600.0 AS dh
      FROM ordered WHERE prev_views IS NOT NULL
    ),
    valid_rates AS (
      SELECT submission_id, dv / NULLIF(dh, 0) AS rate FROM rates WHERE dh > 0
    )
    SELECT submission_id, COUNT(*)::int AS n,
           AVG(rate)::float AS avg_rate,
           COALESCE(STDDEV_POP(rate), 0)::float AS sd_rate,
           MAX(rate)::float AS max_rate
    FROM valid_rates GROUP BY submission_id
  `);
  const settings = await getSettings();
  const maxRateThreshold = settings.fraud_max_views_per_hour || 5000;
  const minCv = settings.fraud_min_smoothness_cv ?? 0.15;
  const map = {};
  for (const row of r.rows) {
    const reasons = [];
    const cv = row.n >= 2 && row.avg_rate > 0 ? row.sd_rate / row.avg_rate : null;
    if (cv !== null && cv < minCv) reasons.push('Рост слишком ровный для органики');
    if (row.max_rate > maxRateThreshold) {
      reasons.push(`Скачок просмотров: ~${Math.round(row.max_rate).toLocaleString('ru-RU')}/час`);
    }
    if (reasons.length) map[row.submission_id] = { suspicious: true, reasons };
  }
  return map;
}
/**
 * Ops Copilot — specific, structured flags an operator should act on, not a
 * vague narrative. Two rule-based checks (deterministic, no LLM — a threshold
 * check needs to be correct every time, not "usually right"):
 *  - a brief that's been live for a while but is still far from filling its slots
 *  - a creator who used to submit regularly and has gone quiet
 * Recommendations only — nothing here changes state, the operator decides.
 * Thresholds live in `settings` (ops_behind_days/ops_fill_ratio/ops_churn_days)
 * so an operator can tune them from the admin panel instead of a redeploy.
 */
export async function getOpsFlags() {
  const settings = await getSettings();
  const behindDays = settings.ops_behind_days ?? 4;
  const fillRatio = settings.ops_fill_ratio ?? 0.5;
  const churnDays = settings.ops_churn_days ?? 14;

  const briefsQ = await pool.query(`
    SELECT b.id, b.title, b.slots,
           EXTRACT(DAY FROM NOW() - b.created_at)::int AS age_days,
           COUNT(s.id) FILTER (WHERE s.status = 'accepted')::int AS accepted_count
      FROM briefs b
      LEFT JOIN submissions s ON s.brief_id = b.id
     WHERE b.status = 'active'
     GROUP BY b.id
  `);
  const behindBriefs = briefsQ.rows
    .filter((b) => b.slots > 0 && b.age_days >= behindDays && b.accepted_count < b.slots * fillRatio)
    .map((b) => ({
      brief_id: b.id,
      title: b.title,
      reason: `${b.age_days} дн. в работе, принято ${b.accepted_count} из ${b.slots} слотов`,
    }))
    .sort((a, b) => b.brief_id - a.brief_id);

  const churnQ = await pool.query(`
    SELECT c.id, c.name, COUNT(s.id)::int AS total_submissions, MAX(s.created_at) AS last_submission_at
      FROM creators c
      JOIN submissions s ON s.creator_id = c.id
     WHERE c.account_open = true AND c.status = 'active'
     GROUP BY c.id
  `);
  const CHURN_DAYS = churnDays;
  const churnRisk = churnQ.rows
    .filter((c) => (Date.now() - new Date(c.last_submission_at).getTime()) / 86400000 >= CHURN_DAYS)
    .map((c) => {
      const daysInactive = Math.floor((Date.now() - new Date(c.last_submission_at).getTime()) / 86400000);
      return {
        creator_id: c.id,
        name: c.name,
        days_inactive: daysInactive,
        reason: `Нет новых видео ${daysInactive} дн. (всего сдал ${c.total_submissions})`,
      };
    })
    .sort((a, b) => b.days_inactive - a.days_inactive);

  return { behindBriefs, churnRisk };
}

/**
 * Campaign Autopilot — recommendations only, the operator clicks to act.
 * "Launch and forget" without the "forget" part: suggests which creators fit
 * an under-filled brief (by their own track record on that platform) and
 * which briefs already met their slot quota and can be paused. Plain ranking
 * SQL, no LLM — a creator-fit ranking has to be reproducible and explainable,
 * not "creative".
 */
export async function getAutopilotRecommendations() {
  const settings = await getSettings();
  const minViews = settings.min_views_per_video || 2000;
  const briefsQ = await pool.query(`
    SELECT b.id, b.title, b.platform, b.slots,
           COUNT(s.id) FILTER (WHERE s.status = 'accepted')::int AS accepted_count
      FROM briefs b
      LEFT JOIN submissions s ON s.brief_id = b.id
     WHERE b.status = 'active' AND b.slots > 0
     GROUP BY b.id
  `);

  const pauseSuggestions = briefsQ.rows
    .filter((b) => b.accepted_count >= b.slots)
    .map((b) => ({ brief_id: b.id, title: b.title, reason: `Слоты заполнены: принято ${b.accepted_count} из ${b.slots}` }))
    .sort((a, b) => b.brief_id - a.brief_id);

  const needMore = briefsQ.rows.filter((b) => b.accepted_count < b.slots);
  const assignSuggestions = [];
  for (const b of needMore) {
    const candidatesQ = await pool.query(
      `SELECT c.id, c.name, c.trust_score,
              AVG(s.views) FILTER (WHERE s.platform = $2 AND s.status = 'accepted' AND s.views >= $3) AS avg_views_platform,
              COUNT(s.id) FILTER (WHERE s.platform = $2 AND s.status = 'accepted')::int AS videos_on_platform
         FROM creators c
         LEFT JOIN submissions s ON s.creator_id = c.id
        WHERE c.account_open = true AND c.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.brief_id = $1 AND a.creator_id = c.id)
        GROUP BY c.id
        ORDER BY videos_on_platform DESC, avg_views_platform DESC NULLS LAST, c.trust_score DESC
        LIMIT 3`,
      [b.id, b.platform, minViews]
    );
    if (candidatesQ.rows.length) {
      assignSuggestions.push({
        brief_id: b.id,
        title: b.title,
        platform: b.platform,
        needed: b.slots - b.accepted_count,
        candidates: candidatesQ.rows.map((c) => ({
          creator_id: c.id,
          name: c.name,
          trust_score: c.trust_score,
          avg_views_platform: c.avg_views_platform ? Math.round(c.avg_views_platform) : null,
          videos_on_platform: c.videos_on_platform,
        })),
      });
    }
  }

  return { assignSuggestions, pauseSuggestions };
}
/** View-count history for one submission (drill-down / debugging the signal above). */
export async function getSubmissionViewHistory(id) {
  const r = await pool.query(
    `SELECT views, to_char(recorded_at,'YYYY-MM-DD HH24:MI') AS at FROM view_snapshots WHERE submission_id=$1 ORDER BY recorded_at`,
    [id]
  );
  return r.rows;
}
/**
 * Business live growth dashboard: cumulative views across the business's whole
 * campaign, by day. Views are entered manually and sparsely (not continuous),
 * so each submission's views are forward-filled to its latest known reading
 * before being summed — this is a real cumulative total, not a same-day sum.
 */
export async function getBusinessGrowth(businessId) {
  const r = await pool.query(
    `SELECT vs.submission_id, vs.views, to_char(vs.recorded_at::date,'YYYY-MM-DD') AS day
       FROM view_snapshots vs
       JOIN submissions s ON s.id = vs.submission_id
       JOIN briefs b ON b.id = s.brief_id
      WHERE b.business_id = $1 AND s.status IN ('sent_to_business','accepted')
      ORDER BY vs.submission_id, vs.recorded_at`,
    [businessId]
  );
  const bySub = new Map();
  for (const row of r.rows) {
    if (!bySub.has(row.submission_id)) bySub.set(row.submission_id, []);
    bySub.get(row.submission_id).push({ day: row.day, views: row.views });
  }
  const allDays = [...new Set(r.rows.map((row) => row.day))].sort();
  const latestBySub = new Map(); // submission_id -> latest known views as we sweep days forward
  const series = [];
  for (const day of allDays) {
    for (const [subId, points] of bySub.entries()) {
      for (const p of points) {
        if (p.day === day) latestBySub.set(subId, p.views);
      }
    }
    const total = [...latestBySub.values()].reduce((a, v) => a + v, 0);
    series.push({ day, views: total });
  }
  return series;
}

/**
 * Printable campaign performance report (3.4 + 1.6): views, accepted videos,
 * spend and cost-per-view per platform, for the business's whole campaign to
 * date. Plain aggregation off the same accepted-submission data the business
 * already sees in Analytics — no new tracking, just a print-friendly rollup.
 */
export async function getBusinessReport(businessId) {
  // Same min-views threshold the creator wallet applies (getCreatorWallet). A
  // video accepted below it earns the creator nothing, so it must cost the brand
  // nothing too — without this filter the printed report billed the client for
  // views no creator was ever paid for, and the two numbers disagreed.
  const settings = await getSettings();
  const minViews = settings.min_views_per_video || 2000;
  const byPlatformQ = await pool.query(
    `SELECT s.platform, COUNT(*)::int AS videos, COALESCE(SUM(s.views), 0)::bigint AS views,
            COALESCE(SUM(s.views * r.client_rate), 0)::float AS spend
       FROM submissions s
       JOIN briefs b ON b.id = s.brief_id
       JOIN rates r ON r.platform = s.platform
      WHERE b.business_id = $1 AND s.status = 'accepted' AND s.views >= $2
      GROUP BY s.platform
      ORDER BY spend DESC`,
    [businessId, minViews]
  );
  const topQ = await pool.query(
    `SELECT s.id, s.platform, s.views, s.video_url, b.title AS brief_title
       FROM submissions s
       JOIN briefs b ON b.id = s.brief_id
      WHERE b.business_id = $1 AND s.status = 'accepted' AND s.views >= $2
      ORDER BY s.views DESC LIMIT 10`,
    [businessId, minViews]
  );
  const byPlatform = byPlatformQ.rows.map((r) => ({
    platform: r.platform,
    videos: r.videos,
    views: Number(r.views),
    spend: Math.round(r.spend),
    cost_per_1k_views: r.views > 0 ? Math.round((r.spend / r.views) * 1000) : 0,
  }));
  return {
    generated_at: new Date().toISOString(),
    totals: {
      videos: byPlatform.reduce((a, p) => a + p.videos, 0),
      views: byPlatform.reduce((a, p) => a + p.views, 0),
      spend: byPlatform.reduce((a, p) => a + p.spend, 0),
    },
    byPlatform,
    topVideos: topQ.rows,
  };
}

/** Per-brief analytics for a business — one row per brief with its own numbers,
 *  so a brand running several campaigns sees each one separately. Counted views
 *  and spend use the same accepted + min-views rule as getBusinessReport; briefs
 *  with no submissions still appear (zeros). */
export async function getBusinessBriefAnalytics(businessId) {
  const settings = await getSettings();
  const minViews = settings.min_views_per_video || 2000;
  const r = await pool.query(
    `SELECT b.id, b.title, b.platform, b.status, b.created_at,
            COUNT(s.id)::int AS submitted,
            COUNT(s.id) FILTER (WHERE s.status = 'accepted')::int AS accepted,
            COALESCE(SUM(s.views) FILTER (WHERE s.status = 'accepted' AND s.views >= $2), 0)::bigint AS views,
            COALESCE(SUM(s.views * rt.client_rate) FILTER (WHERE s.status = 'accepted' AND s.views >= $2), 0)::float AS spend
       FROM briefs b
       LEFT JOIN submissions s ON s.brief_id = b.id
       LEFT JOIN rates rt ON rt.platform = s.platform
      WHERE b.business_id = $1
      GROUP BY b.id, b.title, b.platform, b.status, b.created_at
      ORDER BY views DESC, b.id DESC`,
    [businessId, minViews]
  );
  return r.rows.map((row) => {
    const views = Number(row.views);
    const spend = Math.round(row.spend);
    return {
      id: row.id,
      title: row.title,
      platform: row.platform,
      status: row.status,
      created_at: row.created_at,
      submitted: row.submitted,
      accepted: row.accepted,
      views,
      spend,
      cost_per_1k_views: views > 0 ? Math.round((spend / views) * 1000) : 0,
    };
  });
}

/* ---------------- Platform: wallet & payouts (ТЗ §8) ---------------- */
/** Creator earnings: accepted videos past the min-views threshold × creator_rate, minus paid out. */
// `runner` is pool by default, but createManualPayout passes its transaction
// client so the balance is read under the same advisory lock that guards the
// insert — otherwise two concurrent payouts read the same available and both go.
export async function getCreatorWallet(creatorId, runner = pool) {
  const settings = await getSettings();
  const minViews = settings.min_views_per_video || 2000;
  const earnedQ = await runner.query(
    `SELECT COALESCE(SUM(s.views * r.creator_rate), 0)::float AS earned
       FROM submissions s JOIN rates r ON r.platform = s.platform
      WHERE s.creator_id = $1 AND s.status = 'accepted' AND s.views >= $2`,
    [creatorId, minViews]
  );
  const paidQ = await runner.query(
    `SELECT COALESCE(SUM(amount),0)::float AS paid FROM payouts WHERE creator_id=$1 AND status='paid'`,
    [creatorId]
  );
  // Payouts already queued (created on business-accept) but not yet marked paid.
  // These must NOT be payable again — `available` is what an operator can safely
  // disburse now. `balance` stays "earned − paid" (what the creator is owed).
  const pendingQ = await runner.query(
    `SELECT COALESCE(SUM(amount),0)::float AS pending FROM payouts WHERE creator_id=$1 AND status='pending'`,
    [creatorId]
  );
  const earned = earnedQ.rows[0].earned;
  const paid = paidQ.rows[0].paid;
  const pending = pendingQ.rows[0].pending;
  return {
    earned,
    paid,
    pending,
    balance: earned - paid,
    available: earned - paid - pending,
    payout_threshold: settings.payout_threshold || 10000,
  };
}
/**
 * Earnings Forecaster — projects income from the creator's own recent pace,
 * not a generic promise. Plain computation (not an LLM call): more reliable
 * for numbers, and the underlying data pipeline is the real "AI" value here.
 */
export async function getEarningsForecast(creatorId) {
  const settings = await getSettings();
  const minViews = settings.min_views_per_video || 2000;
  const recentQ = await pool.query(
    `SELECT COALESCE(SUM(s.views * r.creator_rate), 0)::float AS earned30, COUNT(*)::int AS videos30
       FROM submissions s JOIN rates r ON r.platform = s.platform
      WHERE s.creator_id=$1 AND s.status='accepted' AND s.views >= $2
        AND s.reviewed_at >= NOW() - INTERVAL '30 days'`,
    [creatorId, minViews]
  );
  const avgQ = await pool.query(
    `SELECT COALESCE(AVG(s.views * r.creator_rate), 0)::float AS avg_per_video
       FROM submissions s JOIN rates r ON r.platform = s.platform
      WHERE s.creator_id=$1 AND s.status='accepted' AND s.views >= $2`,
    [creatorId, minViews]
  );
  const earned30 = recentQ.rows[0].earned30;
  const avgPerVideo = avgQ.rows[0].avg_per_video;
  return {
    pace_30d: Math.round(earned30),
    videos_30d: recentQ.rows[0].videos30,
    avg_per_video: Math.round(avgPerVideo),
    plus_2_briefs: Math.round(earned30 + avgPerVideo * 2),
  };
}
export async function listPayouts() {
  const r = await pool.query(
    `SELECT p.*, c.name AS creator_name FROM payouts p LEFT JOIN creators c ON c.id=p.creator_id ORDER BY p.id DESC`
  );
  return r.rows;
}
export async function createPayout(creatorId, amount, submissionId) {
  const r = await pool.query(
    'INSERT INTO payouts (creator_id, amount, submission_id) VALUES ($1,$2,$3) RETURNING *',
    [creatorId, amount, submissionId || null]
  );
  return r.rows[0];
}

/**
 * Operator-initiated payout, checked and inserted atomically.
 *
 * The endpoint used to read the wallet and then insert in two separate
 * statements, so two of them at once — a double-click, a retried request — both
 * saw the same `available` and both passed, queuing twice the money the creator
 * had earned. This does the read and the write in one transaction, holding a
 * per-creator advisory lock across both, so the second attempt sees the first's
 * pending row and is turned away.
 *
 * Returns { ok:true, payout } or { ok:false, available, pending } — never throws
 * for the ordinary "not enough balance" case, so the caller can report it.
 */
export async function createManualPayout(creatorId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Two-key form namespaces this lock (77 = "payouts") so a bare creator id
    // can't clash with some other advisory lock elsewhere. Released at COMMIT.
    await client.query('SELECT pg_advisory_xact_lock(77, $1)', [creatorId]);
    const wallet = await getCreatorWallet(creatorId, client);
    if (amount > wallet.available) {
      await client.query('ROLLBACK');
      return { ok: false, available: wallet.available, pending: wallet.pending };
    }
    const r = await client.query(
      'INSERT INTO payouts (creator_id, amount, submission_id) VALUES ($1,$2,NULL) RETURNING *',
      [creatorId, amount]
    );
    await client.query('COMMIT');
    return { ok: true, payout: r.rows[0] };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
/** True if this submission already has a live (pending or paid) payout — used to
 *  stop a re-opened/re-accepted video from creating a second payout. */
export async function hasActivePayoutForSubmission(submissionId) {
  const r = await pool.query(
    "SELECT 1 FROM payouts WHERE submission_id=$1 AND status IN ('pending','paid') LIMIT 1",
    [submissionId]
  );
  return r.rowCount > 0;
}
/** Void a submission's still-unpaid payout (when the video leaves 'accepted').
 *  Already-paid payouts are left untouched. */
export async function cancelPendingPayout(submissionId) {
  await pool.query("UPDATE payouts SET status='cancelled' WHERE submission_id=$1 AND status='pending'", [submissionId]);
}
/**
 * Only a payout that is still pending can be paid. Without the status guard this
 * also "paid" cancelled ones — and cancelled is exactly what a payout becomes
 * when its video is rejected (cancelPendingPayout, just above). The wallet then
 * counts the money as paid while no longer counting it as earned, so the balance
 * goes negative by the amount and the creator cannot be paid again until they
 * re-earn a sum that only exists as a bookkeeping error.
 *
 * Returns null when nothing matched — an already-paid or cancelled row — so the
 * caller can say so instead of reporting a success that never happened.
 */
export async function markPayoutPaid(id) {
  const r = await pool.query(
    "UPDATE payouts SET status='paid', paid_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='pending' RETURNING *",
    [id]
  );
  return r.rows[0] || null;
}
