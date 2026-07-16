import test from 'node:test';
import assert from 'node:assert/strict';

import { maskName, maskContact, maskLeadFields, maskCreatorRow, maskBriefRow } from '../src/mask.js';

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
    spec: { style: 'youth', orientation: 'vertical' },
    // The parts a competitor would actually want:
    goal: 'заявки на релокацию',
    audience: 'IT-специалисты 25-35',
    key_message: 'виза за 3 недели без юриста',
    dos: 'показать паспорт со штампом',
    donts: 'не упоминать конкурентов',
    refs: 'https://drive.google.com/секретная-папка',
    req_cta_link: 'https://client.example/landing?utm=clicki',
  });

  for (const leaked of ['goal', 'audience', 'key_message', 'dos', 'donts', 'refs', 'req_cta_link']) {
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
    spec: { style: 'youth', orientation: 'vertical' },
  });
});

test('maskBriefRow survives an empty or missing row', () => {
  assert.deepEqual(maskBriefRow({}), {});
  assert.deepEqual(maskBriefRow(null), {});
  assert.deepEqual(maskBriefRow(undefined), {});
});
