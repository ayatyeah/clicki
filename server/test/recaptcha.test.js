import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyRecaptcha } from '../src/recaptcha.js';

/* This gate has turned real sign-ups away twice, both times because a failure to
   GRADE a token was treated as proof the visitor was a bot. verifyRecaptcha must
   therefore keep those two outcomes apart: `verified:false` means "no usable
   answer from Google, decide without it", and only `verified:true` carries a
   score that may be judged. */

const realFetch = global.fetch;
const secret = process.env.RECAPTCHA_SECRET;

function withGoogle(payload) {
  global.fetch = async () => ({ json: async () => payload });
}
function restore() {
  global.fetch = realFetch;
  if (secret === undefined) delete process.env.RECAPTCHA_SECRET;
  else process.env.RECAPTCHA_SECRET = secret;
}

test('nothing to grade without a secret or a token', async (t) => {
  t.after(restore);
  delete process.env.RECAPTCHA_SECRET;
  assert.deepEqual(await verifyRecaptcha('tok'), { verified: false, reason: 'no-secret' });

  process.env.RECAPTCHA_SECRET = 'test-secret';
  assert.deepEqual(await verifyRecaptcha(''), { verified: false, reason: 'no-token' });
  assert.deepEqual(await verifyRecaptcha(undefined), { verified: false, reason: 'no-token' });
});

test('a graded token reports its score', async (t) => {
  t.after(restore);
  process.env.RECAPTCHA_SECRET = 'test-secret';

  withGoogle({ success: true, score: 0.9 });
  assert.deepEqual(await verifyRecaptcha('tok'), { verified: true, score: 0.9 });

  // A low score is still a grade — it is the caller's policy that decides.
  withGoogle({ success: true, score: 0.1 });
  assert.deepEqual(await verifyRecaptcha('tok'), { verified: true, score: 0.1 });
});

test('a rejected token is NOT a bot verdict', async (t) => {
  t.after(restore);
  process.env.RECAPTCHA_SECRET = 'test-secret';

  // Reused or >2min old — routine for a human who resubmits a form.
  withGoogle({ success: false, 'error-codes': ['timeout-or-duplicate'] });
  let r = await verifyRecaptcha('tok');
  assert.equal(r.verified, false);
  assert.equal(r.reason, 'timeout-or-duplicate');
  assert.equal(r.score, undefined, 'no score may be inferred from a failure');

  // Our own misconfiguration must never be charged to the visitor.
  withGoogle({ success: false, 'error-codes': ['invalid-input-secret'] });
  assert.equal((await verifyRecaptcha('tok')).verified, false);
});

test('a Google outage never throws at the caller', async (t) => {
  t.after(restore);
  process.env.RECAPTCHA_SECRET = 'test-secret';

  global.fetch = async () => { throw new Error('network down'); };
  const r = await verifyRecaptcha('tok');
  assert.equal(r.verified, false);
  assert.match(r.reason, /fetch-failed/);

  // Malformed body (HTML error page, empty response) — same story.
  global.fetch = async () => ({ json: async () => { throw new Error('not json'); } });
  assert.equal((await verifyRecaptcha('tok')).verified, false);
});
