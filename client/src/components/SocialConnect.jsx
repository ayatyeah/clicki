import { useState } from 'react';

// TikTok note glyph (Font Awesome path, viewBox 448×512). Drawn three times with
// a small offset for the signature cyan/magenta split; the top copy uses
// currentColor so it reads white on the dark button and dark on a white card.
const TT = 'M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z';

export function TikTokLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 448 512" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={TT} fill="#25F4EE" transform="translate(-16 -12)" />
      <path d={TT} fill="#FE2C55" transform="translate(16 12)" />
      <path d={TT} fill="currentColor" />
    </svg>
  );
}

export function InstagramLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Real TikTok connect (Login Kit OAuth). `compact` renders a slim inline control
 * for the "Сдать видео" form (shown only when TikTok is the chosen platform);
 * otherwise a labelled row for the account page. We pass the current path so the
 * OAuth round-trip returns the browser to exactly this page.
 */
export function TikTokConnect({ c, authFetch, reload, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // Note: the OAuth return (?tiktok=connected) is handled once at the CreatorPortal
  // level (toast + reload), since this card isn't mounted on every tab.

  const connect = async () => {
    setBusy(true);
    try {
      const r = await (await authFetch('/api/creator/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect: window.location.pathname }),
      })).json();
      if (r.ok && r.url) window.location.href = r.url;
      else setMsg((r.errors && r.errors[0]) || 'Не удалось начать подключение');
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      await authFetch('/api/creator/tiktok/disconnect', { method: 'POST' });
      reload?.();
    } finally {
      setBusy(false);
    }
  };

  const connected = !!c?.tiktok_connected;

  if (compact) {
    return (
      <div className="cp-connect-inline">
        {connected ? (
          <span className="cp-connect-inline__ok">
            <TikTokLogo size={16} /> TikTok подключён{c.tiktok_username ? ` · @${c.tiktok_username}` : ''} — просмотры подтянутся сами
          </span>
        ) : (
          <>
            <button type="button" className="btn btn--sm cp-connect-btn" onClick={connect} disabled={busy}>
              <TikTokLogo size={16} /> {busy ? '…' : 'Подключить TikTok'}
            </button>
            <span className="cp-connect-inline__hint">чтобы просмотры считались автоматически, без скриншотов</span>
          </>
        )}
        {msg && <span className="creator-portal__muted">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="cp-social__row">
      <span className="cp-social__brand"><TikTokLogo /> TikTok</span>
      <div className="cp-social__ctl">
        {connected ? (
          <>
            <span className="cp-social__status is-on">Подключён{c.tiktok_username ? ` · @${c.tiktok_username}` : ''}</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={disconnect} disabled={busy}>Отключить</button>
          </>
        ) : (
          <button type="button" className="btn btn--sm cp-connect-btn" onClick={connect} disabled={busy}>
            <TikTokLogo size={16} /> {busy ? '…' : 'Подключить'}
          </button>
        )}
        {msg && <span className="creator-portal__muted">{msg}</span>}
      </div>
    </div>
  );
}

/** Instagram — not live yet. Per request, clicking just surfaces "в разработке"
 *  (no OAuth is attempted). Swap for a real <InstagramConnect> once IG keys land. */
export function InstagramSoon() {
  const [clicked, setClicked] = useState(false);
  return (
    <div className="cp-social__row">
      <span className="cp-social__brand cp-social__brand--ig"><InstagramLogo /> Instagram</span>
      <div className="cp-social__ctl">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setClicked(true)}>Подключить</button>
        <span className={`cp-social__status cp-social__status--soon ${clicked ? 'is-shown' : ''}`}>
          {clicked ? '🛠 В разработке — скоро включим' : 'в разработке'}
        </span>
      </div>
    </div>
  );
}
