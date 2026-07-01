import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  ssl: { rejectUnauthorized: false },
});

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
    // AI auto-check result on submissions (pipeline step 7-9)
    await client.query('ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_score INTEGER');
    await client.query('ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_feedback TEXT');
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
  } finally {
    client.release();
  }
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
  const r = await pool.query(`
    SELECT c.*,
      COALESCE(s.accepted,0)::int AS accepted,
      COALESCE(s.rejected,0)::int AS rejected,
      COALESCE(s.avg_ai,0)::float AS avg_ai
    FROM creators c
    LEFT JOIN (
      SELECT creator_id,
        COUNT(*) FILTER (WHERE status='accepted') AS accepted,
        COUNT(*) FILTER (WHERE status='rejected') AS rejected,
        AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL) AS avg_ai
      FROM submissions GROUP BY creator_id
    ) s ON s.creator_id = c.id
    ORDER BY c.id DESC`);
  return r.rows.map((row) => ({ ...row, rating: creatorRating(row) }));
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
  const r = await pool.query(
    `SELECT b.id, b.title, b.req_cta_link, ba.company, ba.name AS business_name, MAX(s.reviewed_at) AS last_accepted
       FROM submissions s
       JOIN briefs b ON b.id = s.brief_id
       LEFT JOIN business_accounts ba ON ba.id = b.business_id
      WHERE s.creator_id = $1 AND s.status = 'accepted' AND b.req_cta_link IS NOT NULL AND b.req_cta_link <> ''
      GROUP BY b.id, b.title, b.req_cta_link, ba.company, ba.name
      ORDER BY last_accepted DESC NULLS LAST`,
    [creator.id]
  );
  return {
    id: creator.id,
    name: creator.name,
    socials: creator.socials || '',
    brandLinks: r.rows.map((row) => ({ title: row.title, url: row.req_cta_link, brand: row.company || row.business_name || null })),
  };
}
export async function getCreatorByToken(token) {
  if (!token) return null;
  const r = await pool.query('SELECT * FROM creators WHERE session_token = $1', [token]);
  return r.rows[0] || null;
}
export async function setCreatorToken(id, token) {
  await pool.query('UPDATE creators SET session_token = $1 WHERE id = $2', [token, id]);
}
// Operator issues / resets a creator's login credentials from the admin panel.
export async function setCreatorCredentials(id, username, password_hash) {
  const r = await pool.query(
    `UPDATE creators SET username = $1, password_hash = $2, status = 'active' WHERE id = $3 RETURNING *`,
    [username, password_hash, id]
  );
  return r.rows[0] || null;
}
export async function createCreator({ name, contact, socials, city, referred_by, username, password_hash, session_token, status }) {
  // Early creators get permanent Founding Creator status (ТЗ §4.5). The cap is a
  // configurable setting (default 50; 0 = unlimited) rather than a hard-coded limit.
  const count = await pool.query('SELECT COUNT(*)::int AS n FROM creators');
  const capRow = await pool.query(`SELECT value::int AS cap FROM settings WHERE key = 'founding_cap'`);
  const cap = capRow.rows[0]?.cap ?? 50;
  const founding = cap === 0 || count.rows[0].n < cap;
  const r = await pool.query(
    `INSERT INTO creators (name, contact, socials, city, referred_by, founding, username, password_hash, session_token, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,'active')) RETURNING *`,
    [name, contact || null, socials || null, city || null, referred_by || null, founding, username || null, password_hash || null, session_token || null, status || null]
  );
  return r.rows[0];
}
export async function updateCreator(id, fields) {
  const allowed = ['account_open', 'onboarding_passed', 'status', 'trust_score'];
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

/* ---------------- Platform: briefs (ТЗ §9) ---------------- */
export async function listBriefs() {
  const r = await pool.query('SELECT * FROM briefs ORDER BY id DESC');
  return r.rows;
}
export async function getBrief(id) {
  const r = await pool.query('SELECT * FROM briefs WHERE id = $1', [id]);
  return r.rows[0] || null;
}
export async function createBrief(b) {
  const r = await pool.query(
    `INSERT INTO briefs
      (title, goal, audience, key_message, platform, duration_min, duration_max,
       req_hashtag, req_mention, req_cta_link, dos, donts, tone, refs, slots, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active') RETURNING *`,
    [
      b.title, b.goal || null, b.audience || null, b.key_message || null, b.platform,
      b.duration_min || 15, b.duration_max || 90, b.req_hashtag || null, !!b.req_mention,
      b.req_cta_link || null, b.dos || null, b.donts || null, b.tone || null, b.refs || null, b.slots || 0,
    ]
  );
  return r.rows[0];
}
export async function setBriefStatus(id, status) {
  const r = await pool.query('UPDATE briefs SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
  return r.rows[0] || null;
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
        duration_max=$5, tone=$6, spec=$7, status='new', revision_note=NULL, ai_score=NULL, ai_feedback=NULL
      WHERE id=$8 AND business_id=$9 AND status IN ('new','revision') RETURNING *`,
    [
      b.title, b.platform || 'TikTok', b.key_message || null, b.req_hashtag || null,
      b.duration_max || 90, b.tone || null, JSON.stringify(b.spec || {}), id, businessId,
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
export async function listAssignmentsForCreator(creatorId) {
  const r = await pool.query(
    `SELECT a.*, b.title, b.platform, b.req_hashtag, b.req_mention, b.req_cta_link,
            b.goal, b.audience, b.key_message, b.duration_min, b.duration_max,
            b.dos, b.donts, b.tone, b.refs, b.spec
       FROM assignments a JOIN briefs b ON b.id = a.brief_id
      WHERE a.creator_id = $1 ORDER BY a.id DESC`,
    [creatorId]
  );
  return r.rows;
}

/* ---------------- Platform: business accounts + their briefs ---------------- */
export async function createBusiness({ name, email, company, password_hash }) {
  const r = await pool.query(
    `INSERT INTO business_accounts (name, email, company, password_hash)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, email, company || null, password_hash]
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
  const r = await pool.query('SELECT * FROM business_accounts WHERE session_token = $1', [token]);
  return r.rows[0] || null;
}
export async function setBusinessToken(id, token) {
  await pool.query('UPDATE business_accounts SET session_token = $1 WHERE id = $2', [token, id]);
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
            b.req_hashtag, b.req_mention, b.req_cta_link, b.duration_min, b.duration_max
       FROM submissions s
       LEFT JOIN creators c ON c.id = s.creator_id
       LEFT JOIN briefs b ON b.id = s.brief_id
       ${where} ORDER BY s.id DESC`,
    params
  );
  return r.rows;
}
export async function listCreatorSubmissions(creatorId) {
  const r = await pool.query(
    `SELECT s.*, b.title AS brief_title FROM submissions s
       LEFT JOIN briefs b ON b.id = s.brief_id
      WHERE s.creator_id = $1 ORDER BY s.id DESC`,
    [creatorId]
  );
  return r.rows;
}
export async function getSubmission(id) {
  const r = await pool.query('SELECT * FROM submissions WHERE id = $1', [id]);
  return r.rows[0] || null;
}
/* Pipeline transitions (steps 7-12) */
export async function setSubmissionAi(id, { ai_score, ai_feedback, status }) {
  const r = await pool.query(
    'UPDATE submissions SET ai_score = $1, ai_feedback = $2, status = $3 WHERE id = $4 RETURNING *',
    [ai_score, ai_feedback || null, status, id]
  );
  return r.rows[0] || null;
}
export async function setSubmissionStatus(id, status) {
  const r = await pool.query('UPDATE submissions SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
  return r.rows[0] || null;
}
/* All published orders — a published brief is open to every creator (broadcast) */
export async function listActiveBriefs() {
  const r = await pool.query("SELECT * FROM briefs WHERE status = 'active' ORDER BY id DESC");
  return r.rows;
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
export async function getSubmissionBusiness(submissionId) {
  const r = await pool.query(
    `SELECT s.*, b.business_id FROM submissions s JOIN briefs b ON b.id = s.brief_id WHERE s.id = $1`,
    [submissionId]
  );
  return r.rows[0] || null;
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
async function handleReferralFirstAccept(creatorId) {
  const c = (await pool.query('SELECT referred_by, referral_qualified FROM creators WHERE id=$1', [creatorId])).rows[0];
  if (!c || !c.referred_by || c.referral_qualified) return;
  const n = (await pool.query(`SELECT COUNT(*)::int AS n FROM submissions WHERE creator_id=$1 AND status='accepted'`, [creatorId])).rows[0].n;
  if (n === 1) {
    await pool.query('UPDATE creators SET referral_qualified=TRUE WHERE id=$1', [creatorId]);
    await pool.query('UPDATE creators SET xp = xp + 500, bonus_xp = bonus_xp + 500 WHERE id=$1', [c.referred_by]);
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

/** Operator review (ТЗ §3.5, §9.2). Acceptance drives streak/XP + referral. */
export async function reviewSubmission(id, { status, reject_code, checklist }) {
  const r = await pool.query(
    `UPDATE submissions SET status=$1, reject_code=$2,
        checklist = COALESCE($3, checklist), reviewed_at = CURRENT_TIMESTAMP
      WHERE id=$4 RETURNING *`,
    [status, reject_code || null, checklist ? JSON.stringify(checklist) : null, id]
  );
  const sub = r.rows[0] || null;
  if (sub && status === 'accepted') {
    await applyStreak(sub.creator_id);
    await recomputeXp(sub.creator_id);
    await handleReferralFirstAccept(sub.creator_id);
  }
  return sub;
}
/** Manual view entry (ТЗ §9). final = 30-day window check done. Recomputes XP. */
export async function recordViews(id, views, final) {
  const r = await pool.query('UPDATE submissions SET views=$1, views_final=$2 WHERE id=$3 RETURNING *', [views, !!final, id]);
  const sub = r.rows[0] || null;
  if (sub) await recomputeXp(sub.creator_id);
  return sub;
}

/* ---------------- Platform: wallet & payouts (ТЗ §8) ---------------- */
/** Creator earnings: accepted videos past the min-views threshold × creator_rate, minus paid out. */
export async function getCreatorWallet(creatorId) {
  const settings = await getSettings();
  const minViews = settings.min_views_per_video || 2000;
  const earnedQ = await pool.query(
    `SELECT COALESCE(SUM(s.views * r.creator_rate), 0)::float AS earned
       FROM submissions s JOIN rates r ON r.platform = s.platform
      WHERE s.creator_id = $1 AND s.status = 'accepted' AND s.views >= $2`,
    [creatorId, minViews]
  );
  const paidQ = await pool.query(
    `SELECT COALESCE(SUM(amount),0)::float AS paid FROM payouts WHERE creator_id=$1 AND status='paid'`,
    [creatorId]
  );
  const earned = earnedQ.rows[0].earned;
  const paid = paidQ.rows[0].paid;
  return { earned, paid, balance: earned - paid, payout_threshold: settings.payout_threshold || 10000 };
}
export async function listPayouts() {
  const r = await pool.query(
    `SELECT p.*, c.name AS creator_name FROM payouts p LEFT JOIN creators c ON c.id=p.creator_id ORDER BY p.id DESC`
  );
  return r.rows;
}
export async function createPayout(creatorId, amount) {
  const r = await pool.query('INSERT INTO payouts (creator_id, amount) VALUES ($1,$2) RETURNING *', [creatorId, amount]);
  return r.rows[0];
}
export async function markPayoutPaid(id) {
  const r = await pool.query(
    "UPDATE payouts SET status='paid', paid_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *",
    [id]
  );
  return r.rows[0] || null;
}
