/**
 * Consistent emoji rendering.
 *
 * Native emoji glyphs vary by OS (Segoe on Windows, etc.), so we swap emoji text
 * for a fixed sprite set served from jsDelivr — the same DOM-parse technique
 * twemoji uses. Misses fall back to the original glyph via onerror.
 *
 * The set is Twemoji, shipped through the `emoji-datasource-twitter` package.
 * Graphics are CC-BY 4.0 (Twitter, Inc. and other contributors) — attribution
 * lives in the site footer and in THIRD_PARTY_NOTICES.md at the repo root.
 *
 * This used to be `emoji-datasource-apple`. Those PNGs are glyphs lifted out of
 * Apple Color Emoji: Apple's copyrighted artwork, licensed for use only on Apple
 * hardware and not redistributable by third parties. The npm package's MIT
 * license covers its code and metadata, not Apple's images. Do not switch back,
 * and do not swap in `emoji-datasource-facebook` either (also proprietary).
 * Freely-licensed alternatives with the identical path layout: `-twitter`
 * (CC-BY 4.0, current) and `-google` (Noto Color Emoji, OFL 1.1).
 */
const BASE = 'https://cdn.jsdelivr.net/npm/emoji-datasource-twitter@15.1.2/img/twitter/64/';

// Keycaps, flags (regional-indicator pairs), and pictographic ZWJ sequences.
const EMOJI_RE =
  /([#*0-9]️?⃣)|(\p{RI}\p{RI})|(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?|\p{Emoji_Modifier})*)/gu;

/** Build the image filename: hex code points, drop VS16 (FE0F), join with '-'. */
function toFilename(emoji) {
  const cps = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp !== 0xfe0f) cps.push(cp.toString(16));
  }
  return cps.join('-');
}

/**
 * Emoji whose image we already failed to load — missing from the sprite set, or
 * blocked outright. Remembering them is what makes the fallback terminal.
 *
 * Restoring the glyph on error looks harmless, but the restored text node is new
 * content as far as the MutationObserver is concerned: it re-parsed it, built the
 * same doomed <img>, and the page spun at the refresh rate — measured at ~60
 * images a second, indefinitely, per emoji. It stayed invisible because the alt
 * text renders the same glyph, so the page looked right while the tab burned.
 */
const failed = new Set();

function makeImg(emoji) {
  const img = document.createElement('img');
  img.className = 'ae';
  img.draggable = false;
  img.alt = emoji;
  img.src = `${BASE}${toFilename(emoji)}.png`;
  // Unknown / unmapped emoji → restore the native glyph rather than a broken icon.
  img.onerror = () => {
    failed.add(emoji);
    img.replaceWith(document.createTextNode(emoji));
  };
  return img;
}

function replaceInTextNode(node) {
  const text = node.nodeValue;
  EMOJI_RE.lastIndex = 0;
  const matches = [];
  let m;
  while ((m = EMOJI_RE.exec(text))) matches.push(m);
  if (!matches.length) return;
  // Nothing here can be improved — every emoji in this node has already failed.
  // Rewriting it would put the same text back and wake the observer for nothing,
  // which is the loop itself.
  if (matches.every((x) => failed.has(x[0]))) return;

  const frag = document.createDocumentFragment();
  let last = 0;
  for (const x of matches) {
    if (x.index > last) frag.appendChild(document.createTextNode(text.slice(last, x.index)));
    frag.appendChild(failed.has(x[0]) ? document.createTextNode(x[0]) : makeImg(x[0]));
    last = x.index + x[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  node.parentNode?.replaceChild(frag, node);
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'IMG']);

// True if the node sits anywhere inside an `.ae-skip` subtree (e.g. admin/cabinets).
function inSkippedSubtree(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.classList?.contains('ae-skip')) return true;
  }
  return false;
}

/** Walk a subtree and convert emoji in its text nodes. */
export function parseEmoji(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentNode;
      if (!p || SKIP_TAGS.has(p.nodeName) || inSkippedSubtree(p)) return NodeFilter.FILTER_REJECT;
      EMOJI_RE.lastIndex = 0;
      return EMOJI_RE.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const targets = [];
  while (walker.nextNode()) targets.push(walker.currentNode);
  targets.forEach(replaceInTextNode);
}

let started = false;
/** Initial pass + observe future DOM changes (assistant, route swaps, etc.). */
export function initEmoji() {
  if (started || typeof window === 'undefined') return;
  started = true;

  parseEmoji(document.body);

  // Re-parse only the subtree that actually changed, not the whole page —
  // walking all of document.body on every mutation gets expensive once
  // something on the page re-renders every few seconds (live dashboards),
  // and shows up as a periodic stutter across the whole site (Aurora and
  // this observer are both mounted globally, on every route).
  let scheduled = false;
  const pending = new Set();
  const observer = new MutationObserver((mutations) => {
    for (const mu of mutations) {
      for (const n of mu.addedNodes) {
        if (n.nodeType === 1 && n.classList?.contains('ae')) continue; // our own <img.ae>, avoid a re-parse loop
        pending.add(n.nodeType === 1 ? n : n.parentElement || document.body);
      }
      if (mu.type === 'characterData') pending.add(mu.target.parentElement || document.body);
    }
    if (!pending.size || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const targets = [...pending];
      pending.clear();
      targets.forEach((t) => parseEmoji(t));
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
