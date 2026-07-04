import 'dotenv/config';
import { resetPlatformData } from './db.js';

/**
 * Danger zone CLI: wipe all account + transactional data for a clean slate.
 *
 * Removes every creator and business account, plus briefs, submissions,
 * assignments, payouts, referral leads, decision journal, view snapshots,
 * OAuth states, visit analytics and the AI cache.
 *
 * Keeps site content (homepage videos / showcase / media) and platform config
 * (rates, settings). The admin account lives in env, not the DB, so it is never
 * touched.
 *
 * Guarded: refuses to run unless you pass the confirm phrase, e.g.
 *   node src/reset-data.js --yes-i-am-sure
 */
async function main() {
  if (!process.argv.includes('--yes-i-am-sure')) {
    console.error(
      'Refusing to wipe data.\n' +
        'This deletes ALL creators, businesses and their data (irreversible).\n' +
        'Re-run with the confirm flag if you really mean it:\n\n' +
        '  node src/reset-data.js --yes-i-am-sure\n'
    );
    process.exit(1);
  }
  console.log('Wiping all accounts + transactional data…');
  await resetPlatformData();
  console.log('Done. All creators, businesses and platform data removed. Admin account is unaffected.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
