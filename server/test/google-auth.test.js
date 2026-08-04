import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

/* googleAuth.js reads GOOGLE_CLIENT_ID once, at import time — so the two modes
   are loaded as two module instances via the ESM query-string trick. Env must be
   set BEFORE the corresponding import: top-level awaits run in order here.
   Nothing in these tests touches the database: the table init is lazy and only
   runs after a credential VERIFIES, which never happens with the garbage token
   below — that laziness is what keeps this file runnable in CI with no DB. */

delete process.env.GOOGLE_CLIENT_ID;
const disabledMode = await import('../src/googleAuth.js?mode=disabled');

process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const enabledMode = await import('../src/googleAuth.js?mode=enabled');

const passThrough = (_req, _res, next) => next();
const denyAdmin = (_req, res) => res.status(401).json({ ok: false });

async function serve(mod) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth/google', mod.createGoogleAuthRouter({ requireAdmin: denyAdmin, loginLimiter: passThrough }));
  const server = await new Promise((resolve) => {
    const s = http.createServer(app).listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => server.close() };
}

test('without GOOGLE_CLIENT_ID the feature reports disabled and rejects logins with 503', async () => {
  assert.equal(disabledMode.googleAuthEnabled, false);
  const { base, close } = await serve(disabledMode);
  try {
    const cfg = await (await fetch(`${base}/api/auth/google/config`)).json();
    assert.deepEqual(cfg, { ok: true, enabled: false, clientId: null });

    const res = await fetch(`${base}/api/auth/google/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'whatever' }),
    });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).ok, false);
  } finally {
    close();
  }
});

test('config exposes the public client id when configured', async () => {
  assert.equal(enabledMode.googleAuthEnabled, true);
  const { base, close } = await serve(enabledMode);
  try {
    const cfg = await (await fetch(`${base}/api/auth/google/config`)).json();
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.clientId, 'test-client-id.apps.googleusercontent.com');
  } finally {
    close();
  }
});

test('a missing credential is a 400, a garbage credential is a 401 — never a session', async () => {
  const { base, close } = await serve(enabledMode);
  try {
    const empty = await fetch(`${base}/api/auth/google/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(empty.status, 400);

    // The security property the whole endpoint rests on: junk that is not a
    // Google-signed JWT must fail verification (locally at JWT parse, or at the
    // certificate check) and must never come back with ok:true + a token.
    const junk = await fetch(`${base}/api/auth/google/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'not-a-real-jwt' }),
    });
    assert.equal(junk.status, 401);
    const body = await junk.json();
    assert.equal(body.ok, false);
    assert.equal(body.token, undefined);
  } finally {
    close();
  }
});
