import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { API_BASE } from '../lib/config.js';
import { createApiClient } from '../lib/apiClient.js';

// Hidden internal sandbox for testing "войти через TikTok / Instagram" before we
// expose it to real creators. Shares the creator session (same token key) but is
// a separate, unlisted route — not in any menu, noindex — so the 170+ creators
// don't see these experimental buttons. Log in with a test creator account.
const KEY = 'clicki_creator_token';

export default function DemoTest() {
  const [token, setToken] = useState(() => localStorage.getItem(KEY) || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const api = useMemo(
    () => createApiClient({ tokenKey: KEY, persistent: true, onUnauthorized: () => { setToken(''); setData(null); } }),
    []
  );
  const { authFetch } = api;

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/creator/me');
      if (res.status === 401 || res.status === 403) return;
      if (!res.ok) throw new Error('load-failed');
      setData(await res.json());
    } catch {
      /* keep the session; the effect retries on next mount */
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { if (token && !data) loadMe(); }, [token, data, loadMe]);

  const onAuthed = (tok, payload) => { api.setToken(tok); setToken(tok); setData(payload); };
  const logout = () => { api.clearToken(); setToken(''); setData(null); };

  const c = data?.creator;

  return (
    <main className="creator-portal page-light app-light ae-skip">
      <Helmet>
        <title>CLICKI — demo-test</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="container creator-portal__inner">
        <div className="demo-banner">
          🧪 DEMO / ТЕСТ — внутренняя страница для проверки входа через соцсети. Креаторам не показывается.
        </div>
        <div className="creator-portal__head">
          <Link to="/" className="creator-portal__brand"><img className="brand-mark" src="/logo-mark.png" alt="" />CLICKI</Link>
          <span className="creator-portal__tag">demo-test</span>
        </div>

        {!token ? (
          <DemoLogin onAuthed={onAuthed} />
        ) : !c ? (
          <p className="creator-portal__muted">{loading ? 'Загрузка…' : '…'}</p>
        ) : (
          <>
            <div className="creator-portal__card">
              <div className="creator-portal__wallet-row"><span>Тестовый аккаунт</span></div>
              <p className="creator-portal__muted">
                Вошёл как <b>{c.name}</b>{c.username ? ` (@${c.username})` : ''}. Ниже — тест подключения соцсетей.
              </p>
              <button className="btn btn--ghost btn--sm" onClick={logout}>Выйти</button>
            </div>
            <TikTokConnectCard c={c} authFetch={authFetch} reload={loadMe} />
            <InstagramConnectCard c={c} authFetch={authFetch} reload={loadMe} />
          </>
        )}
      </div>
    </main>
  );
}

function DemoLogin({ onAuthed }) {
  const [f, setF] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/creator/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || 'Ошибка входа');
      onAuthed(d.token, d);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="creator-portal__card" onSubmit={submit} noValidate>
      <p className="creator-portal__muted">Войди тестовым логином креатора, чтобы проверить подключение TikTok / Instagram.</p>
      <input name="username" placeholder="Логин" autoComplete="username" value={f.username} onChange={(e) => set('username', e.target.value)} />
      <input name="password" type="password" placeholder="Пароль" autoComplete="current-password" value={f.password} onChange={(e) => set('password', e.target.value)} />
      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Вхожу…' : 'Войти'}</button>
    </form>
  );
}

/** Test card: connect TikTok via Login Kit and show the connection state. */
function TikTokConnectCard({ c, authFetch, reload }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('tiktok');
    if (!status) return;
    setMsg(status === 'connected' ? 'TikTok подключён ✓' : 'Не удалось подключить TikTok — попробуй ещё раз.');
    window.history.replaceState(null, '', window.location.pathname);
    reload();
  }, []); // eslint-disable-line

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
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="creator-portal__card">
      <div className="creator-portal__wallet-row"><span>TikTok</span></div>
      {c.tiktok_connected ? (
        <>
          <p className="creator-portal__muted">Подключён{c.tiktok_username ? `: @${c.tiktok_username}` : ''}. Просмотры видео обновляются сами.</p>
          <button className="btn btn--ghost btn--sm" onClick={disconnect} disabled={busy}>Отключить</button>
        </>
      ) : (
        <>
          <p className="creator-portal__muted">Подключи аккаунт — просмотры видео будут подтягиваться автоматически.</p>
          <button className="btn btn--primary btn--sm" onClick={connect} disabled={busy}>{busy ? '…' : 'Войти через TikTok'}</button>
        </>
      )}
      {msg && <p className="creator-portal__muted">{msg}</p>}
    </div>
  );
}

/** Test card: connect an Instagram professional account (Instagram Login for Business). */
function InstagramConnectCard({ c, authFetch, reload }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('instagram');
    if (!status) return;
    setMsg(status === 'connected' ? 'Instagram подключён ✓' : 'Не удалось подключить Instagram — попробуй ещё раз.');
    window.history.replaceState(null, '', window.location.pathname);
    reload();
  }, []); // eslint-disable-line

  const connect = async () => {
    setBusy(true);
    try {
      const r = await (await authFetch('/api/creator/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect: window.location.pathname }),
      })).json();
      if (r.ok && r.url) window.location.href = r.url;
      else setMsg((r.errors && r.errors[0]) || 'Подключение Instagram пока недоступно');
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      await authFetch('/api/creator/instagram/disconnect', { method: 'POST' });
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="creator-portal__card">
      <div className="creator-portal__wallet-row"><span>Instagram</span></div>
      {c.instagram_connected ? (
        <>
          <p className="creator-portal__muted">Подключён{c.ig_username ? `: @${c.ig_username}` : ''}. Просмотры Reels обновляются сами — скриншоты не нужны.</p>
          <button className="btn btn--ghost btn--sm" onClick={disconnect} disabled={busy}>Отключить</button>
        </>
      ) : (
        <>
          <p className="creator-portal__muted">Нужен профессиональный аккаунт (Business/Creator). Статистика по видео будет подтягиваться автоматически.</p>
          <button className="btn btn--primary btn--sm" onClick={connect} disabled={busy}>{busy ? '…' : 'Войти через Instagram'}</button>
        </>
      )}
      {msg && <p className="creator-portal__muted">{msg}</p>}
    </div>
  );
}
