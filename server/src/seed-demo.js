import 'dotenv/config';
import crypto from 'crypto';
import pg from 'pg';

/**
 * Demo seed for screenshots (brief → matching → content → payment).
 * Creates ONE business + brief, ONE creator with wallet/XP, three submissions
 * (two accepted with views + AI score, one in review) and a pending payout.
 *
 * Guarded like the reset script:  node src/seed-demo.js --yes-i-am-sure
 * Run the reset afterwards to get back to a clean slate.
 */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const PW = 'demo1234';

async function main() {
  if (!process.argv.includes('--yes-i-am-sure')) {
    console.error('Refusing to seed demo data into the database.\nRe-run with:  node src/seed-demo.js --yes-i-am-sure');
    process.exit(1);
  }
  const pool = new pg.Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotent: remove this script's own prior demo entities (by the demo
    // email/username) so it can be re-run without duplicates. Other accounts
    // are left untouched. Deleting the creator cascades its submissions/payouts.
    await client.query("DELETE FROM creators WHERE username = 'aruzhan'");
    await client.query("DELETE FROM briefs WHERE business_id IN (SELECT id FROM business_accounts WHERE email = 'business@demo.kz')");
    await client.query("DELETE FROM business_accounts WHERE email = 'business@demo.kz'");

    // 1) Business account + its brief (active → visible in matching).
    const biz = (await client.query(
      `INSERT INTO business_accounts (name, email, company, contact, password_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      ['CLICKI · маркетинг', 'business@demo.kz', 'CLICKI', '@clicki_demo', hashPassword(PW)]
    )).rows[0];

    const spec = {
      orientation: 'vertical',
      max_duration: 30,
      cta_required: true,
      logo_first5: true,
      brand_spoken: true,
      product_in_frame: true,
      style: 'youth',
    };
    const brief = (await client.query(
      `INSERT INTO briefs
        (title, goal, audience, key_message, platform, duration_min, duration_max,
         req_hashtag, req_mention, req_cta_link, dos, donts, tone, slots, status, business_id, spec)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',$15,$16) RETURNING id`,
      [
        'Запуск UGC-платформы CLICKI',
        'Рассказать, что CLICKI — платформа органических просмотров с оплатой за результат: бренды получают охваты, креаторы зарабатывают на коротких видео',
        'Малый и средний бизнес, маркетологи и креаторы 18–30',
        'CLICKI — живая органика с оплатой за результат. Без накруток и фейка.',
        'TikTok', 15, 30,
        '#CLICKI', true, 'https://clicki-platform.com',
        'Показать экран платформы/кабинет, говорить своими словами, дать живой пример',
        'Не обещать гарантированные суммы, не использовать чужой контент',
        'Динамичный, молодёжный', 5, biz.id, JSON.stringify(spec),
      ]
    )).rows[0];

    // 2) Creator with wallet/XP (founding, onboarding passed).
    const cr = (await client.query(
      `INSERT INTO creators
        (name, contact, socials, city, onboarding_passed, xp, trust_score, streak,
         founding, username, password_hash, status)
       VALUES ($1,$2,$3,$4,true,$5,100,$6,true,$7,$8,'active') RETURNING id`,
      [
        'Clicki', '+7 701 234 56 78',
        'instagram.com/clicki.app, tiktok.com/@clicki',
        'Алматы', 1480, 6, 'aruzhan', hashPassword(PW),
      ]
    )).rows[0];

    // 3) Submissions — two accepted (count toward wallet) + one in review.
    const today = new Date();
    const dstr = (daysAgo) => new Date(today.getTime() - daysAgo * 864e5).toISOString().slice(0, 10);
    await client.query(
      `INSERT INTO submissions
        (brief_id, creator_id, platform, video_url, published_at, rights_confirmed,
         status, views, ai_score, reviewed_at)
       VALUES
        ($1,$2,'TikTok','https://tiktok.com/@aruzhan/video/1',$3,true,'accepted',22000,88,NOW()),
        ($1,$2,'Instagram Reels','https://instagram.com/reel/2',$4,true,'accepted',8000,76,NOW()),
        ($1,$2,'TikTok','https://tiktok.com/@aruzhan/video/3',$5,true,'ai_passed',4200,82,NULL)`,
      [brief.id, cr.id, dstr(9), dstr(6), dstr(1)]
    );

    // 4) A pending payout so the payouts screen isn't empty.
    await client.query(
      `INSERT INTO payouts (creator_id, amount, method, status) VALUES ($1,$2,'kaspi','pending')`,
      [cr.id, 7520]
    );

    await client.query('COMMIT');
    console.log('Demo data seeded.\n');
    console.log('Business cabinet  → /business-cabinet   email: business@demo.kz   pass: ' + PW);
    console.log('Creator cabinet   → /creator            login: aruzhan            pass: ' + PW);
    console.log('\nWallet balance ≈ 7 520 ₸ of 10 000 ₸ threshold (2 accepted videos).');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
