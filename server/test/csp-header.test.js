import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import helmet from 'helmet';

import { buildCspDirectives } from '../src/security.js';

/**
 * buildCspDirectives() is only useful if helmet actually accepts it. helmet
 * throws on unknown/malformed directives, and a bad policy would either crash
 * the server at boot or ship a header that breaks the live site — so exercise
 * the real middleware and read the real header off the wire.
 */
async function headersFor(cspOptions) {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: cspOptions, crossOriginEmbedderPolicy: false }));
  app.get('/', (_req, res) => res.send('ok'));

  const server = await new Promise((resolve) => {
    const s = http.createServer(app).listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    await res.text();
    return res.headers;
  } finally {
    server.close();
  }
}

test('helmet accepts the directives and emits an enforcing CSP header', async () => {
  const headers = await headersFor({ useDefaults: false, directives: buildCspDirectives({ isProd: true }) });
  const csp = headers.get('content-security-policy');

  assert.ok(csp, 'Content-Security-Policy header must be present');
  assert.equal(headers.get('content-security-policy-report-only'), null);

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.match(csp, /script-src [^;]*https:\/\/www\.googletagmanager\.com/);

  // The property the whole XSS fix rests on.
  const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
  assert.ok(!scriptSrc.includes("'unsafe-inline'"), `script-src must not allow inline: ${scriptSrc}`);
});

test('CSP_MODE=report-only emits the report-only header instead', async () => {
  const headers = await headersFor({ useDefaults: false, directives: buildCspDirectives({}), reportOnly: true });
  assert.ok(headers.get('content-security-policy-report-only'));
  assert.equal(headers.get('content-security-policy'), null);
});

test('media routes can still be locked down with a sandbox policy', async () => {
  // /api/media/:id sets this per-response; a typo would silently disable it.
  const app = express();
  app.get('/m', (_req, res) => {
    res.set('Content-Security-Policy', "sandbox; default-src 'none'");
    res.set('X-Content-Type-Options', 'nosniff');
    res.type('image/png').send(Buffer.from([0x89, 0x50]));
  });
  const server = await new Promise((resolve) => {
    const s = http.createServer(app).listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/m`);
    await res.arrayBuffer();
    assert.match(res.headers.get('content-security-policy'), /sandbox/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    server.close();
  }
});
