/**
 * Apple-style emoji rendering.
 *
 * Native emoji glyphs vary by OS (Segoe on Windows, etc.). To give the site a
 * consistent Apple look, we swap emoji text for Apple emoji images served from
 * the `emoji-datasource-apple` package via jsDelivr — the same DOM-parse
 * technique twemoji uses. Misses fall back to the original glyph via onerror.
 */
const BASE = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/';

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

function makeImg(emoji) {
  const img = document.createElement('img');
  img.className = 'ae';
  img.draggable = false;
  img.alt = emoji;
  img.src = `${BASE}${toFilename(emoji)}.png`;
  // Unknown / unmapped emoji → restore the native glyph rather than a broken icon.
  img.onerror = () => {
    img.replaceWith(document.createTextNode(emoji));
  };
  return img;
}

function replaceInTextNode(node) {
  const text = node.nodeValue;
  EMOJI_RE.lastIndex = 0;
  if (!EMOJI_RE.test(text)) return;
  EMOJI_RE.lastIndex = 0;

  const frag = document.createDocumentFragment();
  let last = 0;
  let m;
  while ((m = EMOJI_RE.exec(text))) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    frag.appendChild(makeImg(m[0]));
    last = m.index + m[0].length;
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
export function parseAppleEmoji(root = document.body) {
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
export function initAppleEmoji() {
  if (started || typeof window === 'undefined') return;
  started = true;

  const run = () => parseAppleEmoji(document.body);
  run();

  let scheduled = false;
  const observer = new MutationObserver((mutations) => {
    // Ignore our own <img.ae> insertions to avoid a re-parse loop.
    const meaningful = mutations.some((mu) =>
      [...mu.addedNodes].some((n) => !(n.nodeType === 1 && n.classList?.contains('ae')))
    );
    if (!meaningful || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
