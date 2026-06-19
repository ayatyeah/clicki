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
  } finally {
    client.release();
  }
}

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
