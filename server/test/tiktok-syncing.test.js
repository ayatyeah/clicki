import test from 'node:test';
import assert from 'node:assert/strict';

import { tiktokSyncing } from '../src/tiktok.js';

/* The creator cabinet stops asking for daily stats screenshots when this says
   yes. A false yes is expensive and silent: the creator sends nothing, the sync
   skips them anyway, no views are recorded, and it surfaces at payout. So it has
   to answer exactly what listCreatorsWithTikTok() selects:

     WHERE tiktok_access_token IS NOT NULL AND tiktok_refresh_expires_at > NOW()

   Anything this says yes to and that query misses is an unpaid creator. */

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

test('syncing only with a token AND a refresh that has not expired', () => {
  assert.equal(tiktokSyncing({ tiktok_access_token: 'a', tiktok_refresh_expires_at: inDays(30) }), true);
  assert.equal(tiktokSyncing({ tiktok_access_token: 'a', tiktok_refresh_expires_at: inDays(-1) }), false);
});

test('a token alone is not enough — that is the trap tiktok_connected falls into', () => {
  // publicCreator reports this creator as tiktok_connected, yet the sync's WHERE
  // clause drops them: NULL > NOW() is NULL, never true.
  assert.equal(tiktokSyncing({ tiktok_access_token: 'a', tiktok_refresh_expires_at: null }), false);
  assert.equal(tiktokSyncing({ tiktok_access_token: 'a' }), false);
});

test('never syncing without a token, whatever the dates say', () => {
  assert.equal(tiktokSyncing({ tiktok_access_token: null, tiktok_refresh_expires_at: inDays(30) }), false);
  assert.equal(tiktokSyncing({ tiktok_refresh_expires_at: inDays(30) }), false);
});

test('survives junk instead of a row', () => {
  assert.equal(tiktokSyncing(null), false);
  assert.equal(tiktokSyncing(undefined), false);
  assert.equal(tiktokSyncing({}), false);
  // An unparseable date must not read as "still valid".
  assert.equal(tiktokSyncing({ tiktok_access_token: 'a', tiktok_refresh_expires_at: 'вчера' }), false);
});

test('accepts a Date, as pg hands back a timestamp column', () => {
  assert.equal(tiktokSyncing({ tiktok_access_token: 'a', tiktok_refresh_expires_at: new Date(Date.now() + 86400000) }), true);
  assert.equal(tiktokSyncing({ tiktok_access_token: 'a', tiktok_refresh_expires_at: new Date(Date.now() - 86400000) }), false);
});
