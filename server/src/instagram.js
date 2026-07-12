// Instagram API with Instagram Login (Business) — lets a creator connect their
// professional Instagram account once so we can auto-fetch per-video views
// instead of asking for a daily stats screenshot. Mirrors tiktok.js.
//
// Requires a Meta app with "Instagram API (Instagram login)" configured, plus
// App Review + Business Verification for `instagram_business_manage_insights`
// before it works for creators who aren't roled on the app.
// Docs: developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login

const APP_ID = process.env.IG_APP_ID;
const APP_SECRET = process.env.IG_APP_SECRET;
const REDIRECT_URI = process.env.IG_REDIRECT_URI;

export const instagramEnabled = !!(APP_ID && APP_SECRET && REDIRECT_URI);

// Only what we need: profile basics + read insights (views/reach per media).
const SCOPES = 'instagram_business_basic,instagram_business_manage_insights';

/** URL to send a creator to so they can authorize us. `state` is a CSRF token. */
export function instagramAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/**
 * Authorization code → a long-lived (60-day) access token + IG user id/username.
 * Two hops: code → short-lived token, then short → long-lived token.
 */
export async function exchangeInstagramCode(code) {
  // 1) code → short-lived token (also returns the IG user_id)
  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: APP_ID,
      client_secret: APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const shortData = await shortRes.json().catch(() => ({}));
  if (!shortRes.ok || shortData.error_type || !shortData.access_token) {
    throw new Error(`Instagram token error: ${shortData.error_message || shortData.error_type || shortRes.status}`);
  }

  // 2) short-lived → long-lived (60 days)
  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', APP_SECRET);
  longUrl.searchParams.set('access_token', shortData.access_token);
  const longRes = await fetch(longUrl, { signal: AbortSignal.timeout(10000) });
  const longData = await longRes.json().catch(() => ({}));
  if (!longRes.ok || !longData.access_token) {
    throw new Error(`Instagram long-token error: ${longData.error?.message || longRes.status}`);
  }
  return {
    user_id: String(shortData.user_id ?? ''),
    access_token: longData.access_token,
    expires_in: longData.expires_in || 60 * 24 * 3600,
  };
}

/** Refresh a long-lived token (must be done while it's still valid). */
export async function refreshInstagramToken(accessToken) {
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Instagram refresh error: ${data.error?.message || res.status}`);
  return { access_token: data.access_token, expires_in: data.expires_in || 60 * 24 * 3600 };
}

/** Username of the connected account, shown in the creator dashboard. */
export async function fetchInstagramUser(accessToken) {
  const url = new URL('https://graph.instagram.com/me');
  url.searchParams.set('fields', 'user_id,username');
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram user error: ${res.status}`);
  return data; // { user_id, username }
}

/**
 * A creator's recent media with a view count. Pulls the media list (paginated,
 * capped) then reads the `views` insight per item. Returns [{ id, permalink, views }].
 */
export async function fetchInstagramMediaViews(accessToken) {
  const out = [];
  let url = new URL('https://graph.instagram.com/me/media');
  url.searchParams.set('fields', 'id,permalink,media_type,media_product_type');
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('limit', '50');

  for (let page = 0; page < 4 && url; page += 1) {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Instagram media error: ${res.status}`);
    for (const m of data.data || []) {
      const views = await fetchMediaViews(m.id, accessToken);
      out.push({ id: m.id, permalink: m.permalink, views });
    }
    url = data.paging?.next ? new URL(data.paging.next) : null;
  }
  return out;
}

async function fetchMediaViews(mediaId, accessToken) {
  const url = new URL(`https://graph.instagram.com/${mediaId}/insights`);
  url.searchParams.set('metric', 'views');
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null; // some media types don't expose the metric — skip
  return data.data?.[0]?.values?.[0]?.value ?? data.data?.[0]?.total_value?.value ?? null;
}

/** Shortcode from an Instagram reel/post URL (used to match a submission to media). */
export function parseInstagramShortcode(url) {
  const m = String(url || '').match(/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
