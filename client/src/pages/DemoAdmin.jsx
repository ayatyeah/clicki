import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { API_BASE } from '../lib/config.js';
import { BriefsView, ReviewView, BriefViewsView, MonthlyReportView } from './AdminPlatform.jsx';

// Investor demo = a trimmed, READ-ONLY copy of the real admin. Only these seven
// sections are exposed; the business/creator cabinets are reached by logging in
// to the real /business-cabinet and /creator surfaces, not from here.
const NAV = [
  { key: 'dashboard', label: 'Дашборд', icon: 'grid' },
  { key: 'analytics', label: 'Аналитика', icon: 'chart' },
  { key: 'referrals', label: 'Рефералы', icon: 'link' },
  { key: 'briefs', label: 'Брифы', icon: 'briefs' },
  { key: 'brief-views', label: 'Просмотры по брифам', icon: 'eye' },
  { key: 'monthly-report', label: 'Отчёт за месяц', icon: 'chart' },
  { key: 'review', label: 'Проверка видео', icon: 'check' },
];

// Every reused admin component calls authFetch('/api/admin/...'). demoFetch
// rewrites those reads to the public, token-free /api/demo/admin/* mirrors
// (real data), and refuses any write so the demo can never mutate the DB.
function demoFetch(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  // Read-only: block every mutation, plus the CSV export (a full submissions
  // dump shouldn't be downloadable from a public, token-free demo surface).
  const isExport = url.includes('/export');
  if (method !== 'GET' || isExport) {
    return Promise.resolve(
      new Response(
        JSON.stringify({ ok: false, errors: ['Демо-режим только для просмотра — действие отключено'] }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
  const demoUrl = url.replace(/^\/api\/admin\//, '/api/demo/admin/');
  return fetch(`${API_BASE}${demoUrl}`, opts);
}

export default function DemoAdmin() {
  const [view, setView] = useState('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const current = useMemo(() => NAV.find((n) => n.key === view), [view]);

  return (
    <main className="admin page-light app-light ae-skip">
      <Helmet>
        <title>CLICKI — демо админка</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="admin-topbar">
        <button className="admin-topbar__burger" onClick={() => setNavOpen(true)} aria-label="Открыть меню" aria-expanded={navOpen}>
          <span />
          <span />
          <span />
        </button>
        <span className="admin-topbar__title">{current?.label || 'CLICKI демо'}</span>
        <Link to="/" className="btn btn--ghost btn--sm">На сайт</Link>
      </header>

      <div className="admin-layout">
        {navOpen && <div className="admin-backdrop" onClick={() => setNavOpen(false)} />}
        <aside className={`admin-sidebar ${navOpen ? 'is-open' : ''}`}>
          <div className="admin-sidebar__head">
            <div className="admin-sidebar__brand">CLICKI · демо-админка</div>
            <button className="admin-sidebar__close" onClick={() => setNavOpen(false)} aria-label="Закрыть меню">×</button>
          </div>
          <nav className="admin-nav">
            {NAV.map((n) => (
              <button
                key={n.key}
                className={`admin-nav__btn ${view === n.key ? 'is-active' : ''}`}
                onClick={() => {
                  setView(n.key);
                  setNavOpen(false);
                }}
              >
                <span className="admin-nav__icon" aria-hidden="true"><Icon name={n.icon} /></span>
                {n.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="admin-main">
          <div className="demo-banner">
            <span className="demo-pill">Реальные данные · только просмотр</span>
            <span>Инвесторская витрина админки: цифры настоящие, кнопки изменения отключены. Кабинеты бизнеса и креатора — через обычный вход на сайте.</span>
          </div>

          {view === 'dashboard' && <DemoDashboard />}
          {view === 'analytics' && <DemoAnalytics />}
          {view === 'referrals' && <DemoReferrals />}
          {view === 'briefs' && <BriefsView authFetch={demoFetch} />}
          {view === 'brief-views' && <BriefViewsView authFetch={demoFetch} />}
          {view === 'monthly-report' && <MonthlyReportView authFetch={demoFetch} />}
          {view === 'review' && <ReviewView authFetch={demoFetch} />}
        </div>
      </div>
    </main>
  );
}

/* ---------------------------- Дашборд ---------------------------- */
function DemoDashboard() {
  const [leads, setLeads] = useState([]);
  const [showcase, setShowcase] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [l, c] = await Promise.all([
        demoFetch('/api/admin/leads').then((r) => r.json()),
        fetch(`${API_BASE}/api/content`).then((r) => r.json()).catch(() => ({})),
      ]);
      setLeads(l.leads || []);
      setShowcase((c.showcase || []).length);
    } catch (e) {
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const businessLeads = leads.filter((l) => l.funnel === 'client');
  const creatorLeads = leads.filter((l) => l.funnel !== 'client');

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Дашборд</h2>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>{loading ? 'Обновляю…' : 'Обновить'}</button>
      </div>
      {error && <p className="lead-form__errors" role="alert">{error}</p>}
      <div className="kpi-grid">
        <Kpi tone="rose" icon="inbox" value={leads.length} label="Всего заявок" />
        <Kpi tone="violet" icon="user" value={businessLeads.length} label="Заявки бизнеса" />
        <Kpi tone="green" icon="users" value={creatorLeads.length} label="Заявки креаторов" />
        <Kpi tone="amber" icon="video" value={showcase} label="Видео в ленте" />
      </div>

      <h3 className="admin-block__title admin-subhead">Последние заявки</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Воронка</th><th>Данные</th><th>Страница</th><th>Время</th></tr>
          </thead>
          <tbody>
            {leads.slice(0, 6).map((l, i) => (
              <tr key={i}>
                <td data-label="Воронка">
                  <span className={`lead-pill lead-pill--${l.funnel === 'client' ? 'biz' : 'creator'}`}>
                    {l.funnel === 'client' ? 'Бизнес' : 'Креатор'}
                  </span>
                </td>
                <td data-label="Данные">
                  {Object.entries(l.fields || {}).slice(0, 2).map(([, v]) => `${v}`).join(' · ') || '-'}
                </td>
                <td className="muted-cell" data-label="Страница">{l.page || '-'}</td>
                <td className="muted-cell" data-label="Время">{l.createdAt ? new Date(l.createdAt).toLocaleString('ru-RU') : '-'}</td>
              </tr>
            ))}
            {!leads.length && (
              <tr><td colSpan={4} className="admin-table__empty">Заявок пока нет</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --------------------------- Аналитика --------------------------- */
function DemoAnalytics() {
  const [a, setA] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await demoFetch('/api/admin/analytics').then((res) => res.json());
      setA(r.analytics || null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const maxDay = a && a.byDay.length ? Math.max(1, ...a.byDay.map((d) => d.visits)) : 1;
  const dev = a?.device || { mobile: 0, desktop: 0 };
  const devTotal = (dev.mobile || 0) + (dev.desktop || 0);
  const mobilePct = devTotal ? Math.round((dev.mobile / devTotal) * 100) : 0;

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Аналитика посещаемости</h2>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>{loading ? 'Обновляю…' : 'Обновить'}</button>
      </div>
      {!a ? (
        <p className="muted-note" style={{ textAlign: 'left' }}>Загрузка…</p>
      ) : (
        <>
          <div className="admin-stats">
            <Stat label="Всего визитов" value={(a.totals?.visits || 0).toLocaleString('ru-RU')} />
            <Stat label="Уникальных" value={(a.totals?.uniques || 0).toLocaleString('ru-RU')} />
            <Stat label="Сегодня" value={(a.today?.visits || 0).toLocaleString('ru-RU')} />
            <Stat label="Мобильных" value={`${mobilePct}%`} />
          </div>

          <h3 className="admin-block__title admin-subhead">Визиты за 14 дней</h3>
          {a.byDay.length ? (
            <div className="an-days">
              {a.byDay.map((d) => (
                <div key={d.day} className="an-day" title={`${d.day}: ${d.visits} визитов`}>
                  <span className="an-day__bar" style={{ height: `${Math.round((d.visits / maxDay) * 100)}%` }} />
                  <span className="an-day__label">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-note" style={{ textAlign: 'left' }}>Данных пока нет — цифры появятся по мере посещений.</p>
          )}

          <div className="an-cols">
            <div>
              <h3 className="admin-block__title admin-subhead">Топ страниц</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Страница</th><th>Визитов</th></tr></thead>
                  <tbody>
                    {a.byPage.map((p) => (
                      <tr key={p.path}><td data-label="Страница">{p.path}</td><td className="muted-cell" data-label="Визитов">{p.visits}</td></tr>
                    ))}
                    {!a.byPage.length && <tr><td colSpan={2} className="admin-table__empty">—</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="admin-block__title admin-subhead">Источники трафика</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Источник</th><th>Визитов</th></tr></thead>
                  <tbody>
                    {a.bySource.map((s) => (
                      <tr key={s.source}><td data-label="Источник">{s.source}</td><td className="muted-cell" data-label="Визитов">{s.visits}</td></tr>
                    ))}
                    {!a.bySource.length && <tr><td colSpan={2} className="admin-table__empty">—</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <h3 className="admin-block__title admin-subhead">Устройства</h3>
          <div className="bp-bars">
            <div className="bp-bar">
              <span className="bp-bar__label">Мобильные</span>
              <span className="bp-bar__track"><span className="bp-bar__fill" style={{ width: `${mobilePct}%` }} /></span>
              <span className="bp-bar__val">{dev.mobile}</span>
            </div>
            <div className="bp-bar">
              <span className="bp-bar__label">Десктоп</span>
              <span className="bp-bar__track"><span className="bp-bar__fill" style={{ width: `${100 - mobilePct}%` }} /></span>
              <span className="bp-bar__val">{dev.desktop}</span>
            </div>
          </div>

          <h3 className="admin-block__title admin-subhead">Куда нажимают (кнопки и переходы)</h3>
          {a.topClicks && a.topClicks.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Действие</th><th>Нажатий</th></tr></thead>
                <tbody>
                  {a.topClicks.map((c) => (
                    <tr key={c.label}><td data-label="Действие">{c.label}</td><td className="muted-cell" data-label="Нажатий">{c.clicks}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-note" style={{ textAlign: 'left' }}>Пока нет данных о нажатиях.</p>
          )}
        </>
      )}
    </section>
  );
}

/* --------------------------- Рефералы ---------------------------- */
function DemoReferrals() {
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await demoFetch('/api/admin/referrals').then((x) => x.json());
      setR(res.referrals || null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Рефералы</h2>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>{loading ? 'Обновляю…' : 'Обновить'}</button>
      </div>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Заявки бизнеса, пришедшие по персональной ссылке креатора (та, что он размещает в шапке профиля). За каждую такую заявку креатор получает {r?.xpPerLead ?? 30} XP.
      </p>
      {!r ? (
        <p className="muted-note" style={{ textAlign: 'left' }}>Загрузка…</p>
      ) : (
        <>
          <div className="kpi-grid">
            <Kpi tone="violet" icon="link" value={r.total} label="Заявок по рефералам" />
            <Kpi tone="green" icon="users" value={r.byCreator.length} label="Креаторов привели заявки" />
          </div>
          <div className="admin-table-wrap" style={{ marginTop: 16 }}>
            <table className="admin-table">
              <thead>
                <tr><th>Креатор</th><th>Логин</th><th>Заявок</th><th>XP от рефералов</th></tr>
              </thead>
              <tbody>
                {r.byCreator.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Креатор">{c.name}</td>
                    <td className="muted-cell" data-label="Логин">{c.username || '-'}</td>
                    <td data-label="Заявок">{c.leads}</td>
                    <td className="muted-cell" data-label="XP от рефералов">{c.leads * r.xpPerLead}</td>
                  </tr>
                ))}
                {!r.byCreator.length && (
                  <tr><td colSpan={4} className="admin-table__empty">Пока нет заявок по рефералам</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------------------- helpers ---------------------------- */
function Stat({ label, value }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat__value">{value}</div>
      <div className="admin-stat__label">{label}</div>
    </div>
  );
}

function Kpi({ tone = 'violet', icon, value, label }) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <span className="kpi__icon"><Icon name={icon} /></span>
      <div className="kpi__value">{value}</div>
      <div className="kpi__label">{label}</div>
    </div>
  );
}
