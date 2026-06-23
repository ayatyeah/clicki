import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        src TEXT NOT NULL,
        poster TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS media (
        id SERIAL PRIMARY KEY,
        mime VARCHAR(120) NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    client.release();
  }
}

/* ---------------- Showcase videos (CMS feed) ---------------- */

export async function getVideos() {
  const result = await pool.query('SELECT * FROM videos ORDER BY id ASC');
  return result.rows.map(row => ({
    type: row.type,
    src: row.src,
    poster: row.poster
  }));
}

export async function saveVideos(videos) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM videos');

    for (const v of videos) {
      await client.query(
        'INSERT INTO videos (type, src, poster) VALUES ($1, $2, $3)',
        [v.type, v.src, v.poster]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* ---------------- Media blobs (uploaded images/videos) ---------------- */

/** Store an uploaded file's bytes; returns its new id. */
export async function saveMedia(mime, buffer) {
  const result = await pool.query(
    'INSERT INTO media (mime, data) VALUES ($1, $2) RETURNING id',
    [mime, buffer]
  );
  return result.rows[0].id;
}

/** Fetch a media blob by id, or null if missing. */
export async function getMedia(id) {
  const result = await pool.query('SELECT mime, data FROM media WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return { mime: result.rows[0].mime, data: result.rows[0].data };
}

/**
 * Fetch only a media row's mime — cheap: selecting just `mime` does NOT
 * de-TOAST the big `data` column, so this avoids reading the blob per request.
 */
export async function getMediaMeta(id) {
  const result = await pool.query('SELECT mime FROM media WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return { mime: result.rows[0].mime };
}
