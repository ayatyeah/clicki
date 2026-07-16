import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeContact } from '../src/validate.js';

/* A business account's contact is the only way we can reach a brand, and it is
   required on every new account — so what counts as one is worth pinning down.
   client/src/lib/contact.js mirrors these rules for inline errors; this is the
   copy that guards the writes. */

test('phones keep their digits and lose the typing', () => {
  assert.equal(normalizeContact('+7 707 123 45 67'), '+77071234567');
  assert.equal(normalizeContact('+7 (707) 123-45-67'), '+77071234567');
  // No country code is invented: 8707… is stored as typed, not "corrected" to +7707….
  assert.equal(normalizeContact('8-707-123-45-67'), '87071234567');
});

test('telegram is stored as @handle however it was typed', () => {
  assert.equal(normalizeContact('@username'), '@username');
  assert.equal(normalizeContact('https://t.me/username'), '@username');
  assert.equal(normalizeContact('t.me/username'), '@username');
  assert.equal(normalizeContact('www.t.me/username'), '@username');
  assert.equal(normalizeContact('@user_name_1'), '@user_name_1');
});

test('anything we could not actually call or message is rejected', () => {
  assert.equal(normalizeContact(''), null);
  assert.equal(normalizeContact('   '), null);
  assert.equal(normalizeContact(null), null);
  assert.equal(normalizeContact(undefined), null);
  assert.equal(normalizeContact(42), null);
  assert.equal(normalizeContact('позвоните мне'), null);
  assert.equal(normalizeContact('username'), null, 'a bare word is not a handle');
  assert.equal(normalizeContact('123'), null, 'too few digits to be a phone');
  assert.equal(normalizeContact('+7707123456789012345'), null, 'too many digits to be a phone');
  assert.equal(normalizeContact('@user'), null, 'telegram handles are 5+ chars');
  assert.equal(normalizeContact('@_username'), null, 'telegram handles start with a letter');
  assert.equal(normalizeContact('@user name'), null);
  assert.equal(normalizeContact('https://t.me/user?start=1'), null, 'no query strings smuggled into the link');
});

test('a contact can never become a script URL', () => {
  // The admin table turns this value into an href, so a rejected value there is
  // the same guarantee safeHref() gives elsewhere.
  assert.equal(normalizeContact('javascript:alert(1)'), null);
  assert.equal(normalizeContact('@user"><script>'), null);
});
