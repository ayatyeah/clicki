// Analytics — GA4 + Meta Pixel + (opt.) Yandex.Metrika with split funnel events
// (ТЗ 3.6 / 10 / 13). Everything is config-gated: with no IDs set, it's a no-op.

const GA4_ID = import.meta.env.VITE_GA4_ID || '';
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '';
const YM_ID = import.meta.env.VITE_YANDEX_METRIKA_ID || '';

let inited = false;

/** Inject the configured trackers once (called on app mount). */
export function initAnalytics() {
  if (inited || typeof window === 'undefined') return;
  inited = true;

  if (GA4_ID) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
  }

  if (PIXEL_ID) {
    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  if (YM_ID) {
    /* eslint-disable */
    (function (m, e, t, r, i, k, a) {
      m[i] =
        m[i] ||
        function () {
          (m[i].a = m[i].a || []).push(arguments);
        };
      m[i].l = 1 * new Date();
      (k = e.createElement(t)), (a = e.getElementsByTagName(t)[0]), (k.async = 1), (k.src = r), a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    /* eslint-enable */
    window.ym(YM_ID, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
  }
}

/** Report a virtual pageview on SPA route change. */
export function trackPageview(path) {
  if (typeof window === 'undefined') return;
  if (GA4_ID && window.gtag) window.gtag('event', 'page_view', { page_path: path });
  if (PIXEL_ID && window.fbq) window.fbq('track', 'PageView');
  if (YM_ID && window.ym) window.ym(YM_ID, 'hit', path);
}

/** Fire the funnel-specific lead conversion event. */
export function trackLead(funnel) {
  if (typeof window === 'undefined') return;
  const event = funnel === 'creator' ? 'creator_lead' : 'client_lead';
  if (GA4_ID && window.gtag) window.gtag('event', event, { funnel });
  if (PIXEL_ID && window.fbq) window.fbq('track', 'Lead', { funnel, content_name: event });
  if (YM_ID && window.ym) window.ym(YM_ID, 'reachGoal', event);
}
