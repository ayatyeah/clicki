import 'dotenv/config';
import pg from 'pg';
import { buildPoolConfig } from './dbConfig.js';

/**
 * Deletes ALL briefs so freshly-registered creators don't see (and can't
 * accidentally take) leftover test orders. Safe by schema:
 *   - assignments.brief_id  → ON DELETE CASCADE (assignments removed)
 *   - submissions.brief_id  → ON DELETE SET NULL (already-sent videos survive)
 *   - payouts.brief_id      → ON DELETE SET NULL
 *
 * Guarded like the seed/reset scripts so it can never run by accident:
 *   node src/clean-briefs.js --yes-i-am-sure
 *
 * Businesses can then create real briefs from the business cabinet as usual.
 */
async function main() {
  if (!process.argv.includes('--yes-i-am-sure')) {
    console.error('Refusing to delete briefs.\nRe-run with:  node src/clean-briefs.js --yes-i-am-sure');
    process.exit(1);
  }
  // SSL/хост берутся из ./dbConfig.js — один и тот же конфиг, что и у боевого
  // пула. Скрипт одинаково работает и против managed Postgres (App Platform),
  // и против локального Postgres в Docker (DB_SSL=disable).
  const pool = new pg.Pool(buildPoolConfig({ connectionTimeoutMillis: 12000 }));
  const client = await pool.connect();
  try {
    const before = (await client.query('SELECT COUNT(*)::int AS n FROM briefs')).rows[0].n;
    const r = await client.query('DELETE FROM briefs');
    console.log(`Deleted ${r.rowCount} of ${before} briefs.`);
    console.log('Submissions kept (brief_id set to NULL); assignments cascaded away.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});
