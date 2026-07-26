import test from 'node:test';
import assert from 'node:assert/strict';

import { LEGAL_DOCS, REQUIRED_DOCS, currentLegalVersion } from '../src/legalDocs.js';

/* This module is the single source of truth the registration gate, the
   in-cabinet LegalGate, and the admin history view all read from. Getting the
   required-doc lists wrong here means either a creator/business could slip
   past registration without accepting a document, or an already-accepted user
   gets stuck behind a gate for a document that was never bumped. */

test('creators must accept both the offer and the PDn consent', () => {
  assert.deepEqual(REQUIRED_DOCS.creator, ['offer', 'personal_data_consent']);
});

test('businesses only need the PDn consent, not the offer', () => {
  assert.deepEqual(REQUIRED_DOCS.business, ['personal_data_consent']);
  assert.ok(!REQUIRED_DOCS.business.includes('offer'));
});

test('every required doc has a version string', () => {
  for (const role of Object.keys(REQUIRED_DOCS)) {
    for (const doc of REQUIRED_DOCS[role]) {
      assert.ok(LEGAL_DOCS[doc]?.version, `${doc} must declare a version`);
    }
  }
});

test('currentLegalVersion is stable for the same inputs and differs across roles', () => {
  const creatorVersion = currentLegalVersion('creator');
  assert.equal(creatorVersion, currentLegalVersion('creator'));
  assert.notEqual(creatorVersion, currentLegalVersion('business'));
  // Encodes both doc type and version, so a version bump on either doc changes it.
  assert.match(creatorVersion, /offer:.*personal_data_consent:/);
});
