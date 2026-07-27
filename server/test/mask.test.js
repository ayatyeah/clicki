import test from 'node:test';
import assert from 'node:assert/strict';

import {
  maskName, maskContact, maskLeadFields, maskCreatorRow, maskBriefRow,
  maskCreatorForDemo, maskSubmissionRow,
} from '../src/mask.js';

/* The /demo-admin endpoints are public and unauthenticated. Nothing that leaves
   them may identify or let anyone contact a real person. */

test('maskName keeps the shape of a name but not the name', () => {
  assert.equal(maskName('Иван'), 'И***');
  assert.equal(maskName('Иван Петров'), 'И*** П*****');
  assert.equal(maskName('A'), 'A');
  assert.equal(maskName(''), '');
  assert.equal(maskName(null), '');
  // Long surnames must not leak their length beyond the 5-star cap.
  assert.equal(maskName('Константинопольский'), 'К*****');
});

test('maskContact hides phone digits', () => {
  const masked = maskContact('+7 700 123 45 67');
  assert.ok(!masked.includes('123'), 'middle digits must not survive');
  assert.ok(!masked.includes('45'), 'middle digits must not survive');
  assert.ok(masked.startsWith('+7'));
  assert.ok(masked.endsWith('67'));
});

test('maskContact hides the local part of an email but keeps the domain', () => {
  assert.equal(maskContact('turar.abukhan@gmail.com'), 't***@gmail.com');
  assert.equal(maskContact('a@b.io'), 'a***@b.io');
});

test('maskContact handles short handles and empty input', () => {
  assert.equal(maskContact('bob'), 'b***');
  assert.equal(maskContact(''), '');
  assert.equal(maskContact(undefined), '');
});

test('maskLeadFields masks identity fields and keeps business context', () => {
  const masked = maskLeadFields({
    Имя: 'Иван Петров',
    Телефон: '+7 700 123 45 67',
    Email: 'ivan@corp.kz',
    Компания: 'ТОО Ромашка',
    'Сфера бизнеса': 'кофейни',
    Комментарий: 'хотим 100к просмотров',
  });

  assert.equal(masked['Имя'], 'И*** П*****');
  assert.ok(!masked['Телефон'].includes('123'));
  assert.equal(masked['Email'], 'i***@corp.kz');
  // Not personal identifiers — the demo would be pointless without them.
  assert.equal(masked['Компания'], 'ТОО Ромашка');
  assert.equal(masked['Сфера бизнеса'], 'кофейни');
  assert.equal(masked['Комментарий'], 'хотим 100к просмотров');
});

test('maskLeadFields matches the English/Telegram label variants too', () => {
  const masked = maskLeadFields({ Name: 'John Smith', Phone: '+1 555 010 9999', Telegram: '@johnny' });
  assert.equal(masked.Name, 'J*** S****');
  assert.ok(!masked.Phone.includes('010'));
  assert.ok(!masked.Telegram.includes('johnny'));
});

test('maskLeadFields tolerates missing / empty field maps', () => {
  assert.deepEqual(maskLeadFields(undefined), {});
  assert.deepEqual(maskLeadFields({}), {});
});

test('maskCreatorRow masks name and login, preserves metrics', () => {
  // 'Айгерим' is 7 chars but yields only 5 stars: the cap stops the mask from
  // leaking the original length.
  assert.deepEqual(maskCreatorRow({ id: 3, name: 'Айгерим Ким', username: 'aigerim', leads: 12 }), {
    id: 3,
    name: 'А***** К**',
    username: 'a*****',
    leads: 12,
  });
  assert.equal(maskCreatorRow({ name: 'X', username: null }).username, null);
});

test('maskBriefRow drops a client campaign but keeps the moderation flow', () => {
  const masked = maskBriefRow({
    id: 7,
    title: 'Жизнь за границей стала проще!',
    status: 'new',
    platform: 'TikTok',
    duration_max: 25,
    req_hashtag: '#relocate',
    ai_score: 82,
    // The whole creative brief lives in this one JSONB column. It was on the
    // allowlist from when it only held a style flag, and every field added to it
    // since then rode out to the public endpoint for free.
    spec: {
      style: 'youth',
      product: 'сопровождение релокации под ключ',
      usp: 'виза за 3 недели без юриста',
      audience_pain: 'боятся отказа и потери денег на юристе',
      hook: 'первые 3 секунды — штамп в паспорте крупным планом',
      refs: [{ url: 'https://drive.google.com/секретная-папка', note: 'вот такой темп нравится' }],
    },
    // The parts a competitor would actually want:
    goal: 'заявки на релокацию',
    audience: 'IT-специалисты 25-35',
    key_message: 'виза за 3 недели без юриста',
    dos: 'показать паспорт со штампом',
    donts: 'не упоминать конкурентов',
    refs: 'https://drive.google.com/секретная-папка',
    req_cta_link: 'https://client.example/landing?utm=clicki',
  });

  for (const leaked of ['goal', 'audience', 'key_message', 'dos', 'donts', 'refs', 'req_cta_link', 'spec']) {
    assert.ok(!(leaked in masked), `${leaked} must not reach the public demo endpoint`);
  }
  // What the demo page renders survives untouched, so the queue still looks real.
  assert.deepEqual(masked, {
    id: 7,
    title: 'Жизнь за границей стала проще!',
    status: 'new',
    platform: 'TikTok',
    duration_max: 25,
    req_hashtag: '#relocate',
    ai_score: 82,
  });
});

/* A JSONB column is a moving target: whatever it grows to hold ships the day it
   is added, with no diff to review. Nothing on the demo allowlist may be one. */
test('no JSONB blob is allowlisted wholesale', () => {
  const masked = maskBriefRow({
    id: 1,
    title: 'x',
    spec: { anything_added_later: 'must not ship by default' },
  });
  assert.ok(!('spec' in masked));
});

test('maskBriefRow survives an empty or missing row', () => {
  assert.deepEqual(maskBriefRow({}), {});
  assert.deepEqual(maskBriefRow(null), {});
  assert.deepEqual(maskBriefRow(undefined), {});
});

/* The demo row maskers are allowlists. These tests feed them a row shaped like
   the real `SELECT *` — including the columns that actually leaked — and assert
   on the whole output, so a future column has to be added to the test before it
   can reach the public endpoint. */

test('maskCreatorForDemo sends an id and a masked name, and nothing else', () => {
  const masked = maskCreatorForDemo({
    id: 42,
    name: 'Аружан Кимова',
    // Everything below reached anonymous callers of /api/demo/admin/creators:
    email: 'aruzhan.kimova@gmail.com',
    tiktok_username: 'Аружан Кимова', // TikTok's display_name — the real name
    ig_username: 'aruzhan.official',
    contact: '+7 707 123 45 67',
    username: 'aruzhan',
    bio: 'Снимаю про кофе',
    city: 'Астана',
    avatar_url: 'https://cdn.example.com/42.jpg',
    tg_id: '123456789',
    earned: 184000,
    paid: 120000,
    trust_score: 100,
  });

  assert.deepEqual(masked, { id: 42, name: 'А***** К*****' });
});

test('maskSubmissionRow keeps the review queue working without the client campaign', () => {
  const row = {
    id: 9,
    brief_id: 3,
    brief_title: 'Жизнь за границей стала проще!',
    creator_id: 42,
    creator_name: 'Аружан Кимова',
    platform: 'TikTok',
    status: 'accepted',
    views: 61000,
    views_history: [{ at: '2026-07-16', views: 61000 }],
    video_url: 'https://www.tiktok.com/@aruzhan/video/123',
    published_at: '2026-07-14',
    rights_confirmed: true,
    ai_score: 88,
    ai_feedback: 'Отличный хук',
    coach_feedback: 'Добавь CTA',
    review_note: 'ок',
    reject_code: null,
    fraud: false,
    screenshots_count: 3,
    last_screenshot_at: '2026-07-16T10:00:00Z',
    // The parts that must not leave:
    req_cta_link: 'https://client.example/landing?utm=clicki',
    screenshot_url: 'https://cdn.example.com/stats-with-account-name.jpg',
    req_hashtag: '#relocate',
    req_mention: true,
    duration_min: 15,
    duration_max: 25,
  };
  const masked = maskSubmissionRow(row);

  assert.equal(masked.creator_name, 'А***** К*****');
  for (const leaked of ['req_cta_link', 'screenshot_url', 'req_hashtag', 'req_mention', 'duration_min', 'duration_max']) {
    assert.ok(!(leaked in masked), `${leaked} must not reach the public demo endpoint`);
  }
  // The review queue still has everything it renders.
  assert.equal(masked.views, 61000);
  assert.equal(masked.brief_title, 'Жизнь за границей стала проще!');
  assert.equal(masked.ai_score, 88);
});

test('the demo maskers ignore columns nobody has allowed yet', () => {
  // The failure mode being locked out: a column added to the table tomorrow.
  assert.ok(!('secret_new_column' in maskCreatorForDemo({ id: 1, name: 'X', secret_new_column: 'oops' })));
  assert.ok(!('secret_new_column' in maskSubmissionRow({ id: 1, secret_new_column: 'oops' })));
  assert.ok(!('secret_new_column' in maskBriefRow({ id: 1, secret_new_column: 'oops' })));
});
