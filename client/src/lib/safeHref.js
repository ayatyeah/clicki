/**
 * Guard for any href that comes from user-supplied data (a creator's video link,
 * a brand's CTA link). React renders `javascript:` hrefs as-is — it only warns in
 * dev — so an operator clicking a submitted link in the review queue would run
 * the submitter's script on our origin, with their session token in reach.
 *
 * Returns the URL when it is a plain http(s) link, otherwise `undefined` so React
 * omits the attribute entirely and the anchor is inert.
 *
 * The server rejects these on write too (server/src/security.js safeHttpUrl);
 * this is the second lock, and it also covers rows written before that check
 * existed. Kept dependency-free and separate from ./utils.js on purpose: utils
 * pulls in clsx + tailwind-merge (~28 kB), which the portal pages must not load
 * just to sanitise a link.
 */
export function safeHref(url) {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const { protocol } = new URL(trimmed, window.location.origin);
    return protocol === 'http:' || protocol === 'https:' ? trimmed : undefined;
  } catch {
    return undefined;
  }
}
