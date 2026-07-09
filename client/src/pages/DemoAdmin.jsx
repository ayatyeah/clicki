import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

const TOKEN_KEY = 'clicki_demo_admin';
const DEMO_USER = 'admin';
const DEMO_PASS = 'lsdlisbsdbgkhfds47592ns';

const leads = [
  { funnel: 'business', name: 'Alem Coffee', contact: '@alemcoffee', page: '/business', createdAt: '2026-07-08T13:20:00Z' },
  { funnel: 'creator', name: 'Aisulu N.', contact: '@aisuugc', page: '/creators', createdAt: '2026-07-08T11:05:00Z' },
  { funnel: 'business', name: 'Nomad Fit', contact: '+7 777 080 44 44', page: '/business', createdAt: '2026-07-07T16:42:00Z' },
  { funnel: 'creator', name: 'Miras shortform', contact: '@miras.video', page: '/creators', createdAt: '2026-07-07T09:12:00Z' },
];

const briefs = [
  { id: 1, title: 'Summer coffee launch', platform: 'TikTok', status: 'active', slots: '8/12', views: 284000 },
  { id: 2, title: '14-day fitness challenge', platform: 'Instagram Reels', status: 'review', slots: '5/6', views: 146500 },
  { id: 3, title: 'Healthy delivery review', platform: 'YouTube Shorts', status: 'draft', slots: '0/8', views: 0 },
];

const creators = [
  { name: 'Aisulu N.', city: 'Astana', status: 'active', trust: 92, videos: 18, views: 912000 },
  { name: 'Miras shortform', city: 'Almaty', status: 'active', trust: 88, videos: 14, views: 641000 },
  { name: 'Dana UGC', city: 'Astana', status: 'pending', trust: 74, videos: 6, views: 204000 },
];

const payouts = [
  { creator: 'Aisulu N.', amount: 184000, status: 'paid' },
  { creator: 'Miras shortform', amount: 121000, status: 'pending' },
  { creator: 'Dana UGC', amount: 43000, status: 'pending' },
];

const contentItems = [
  { name: 'Home video', type: '9:16', status: 'published' },
  { name: 'Creator page video', type: '16:9', status: 'review' },
  { name: 'iPhone screen', type: 'image', status: 'ready' },
  { name: 'Laptop screen', type: 'image', status: 'ready' },
];

const monthly = [
  { day: '06-26', visits: 420 },
  { day: '06-27', visits: 610 },
  { day: '06-28', visits: 530 },
  { day: '06-29', visits: 780 },
  { day: '06-30', visits: 690 },
  { day: '07-01', visits: 940 },
  { day: '07-02', visits: 880 },
  { day: '07-03', visits: 1120 },
  { day: '07-04', visits: 990 },
  { day: '07-05', visits: 1260 },
  { day: '07-06', visits: 1310 },
  { day: '07-07', visits: 1480 },
  { day: '07-08', visits: 1530 },
  { day: '07-09', visits: 1610 },
];

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { key: 'analytics', label: 'Analytics', icon: 'chart' },
  { key: 'briefs', label: 'Briefs', icon: 'briefs' },
  { key: 'review', label: 'Video review', icon: 'check' },
  { key: 'creators', label: 'Creators', icon: 'users' },
  { key: 'businesses', label: 'Businesses', icon: 'user' },
  { key: 'payouts', label: 'Payouts', icon: 'wallet' },
  { key: 'content', label: 'Site content', icon: 'image' },
  { key: 'settings', label: 'Settings', icon: 'sparkle' },
];

export default function DemoAdmin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState('');

  const totals = useMemo(() => ({
    leads: leads.length,
    creators: creators.length,
    views: briefs.reduce((sum, b) => sum + b.views, 0),
    payouts: payouts.reduce((sum, p) => sum + p.amount, 0),
  }), []);

  function onLogin(e) {
    e.preventDefault();
    setError('');
    if (username === DEMO_USER && password === DEMO_PASS) {
      sessionStorage.setItem(TOKEN_KEY, 'demo');
      setToken('demo');
      return;
    }
    setError('Wrong login or password');
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
  }

  function demoAction(label = 'Demo action completed') {
    setToast(label);
    window.setTimeout(() => setToast(''), 1800);
  }

  if (!token) {
    return (
      <main className="admin page-light app-light ae-skip">
        <Helmet>
          <title>CLICKI - demo admin</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <form className="admin-login lead-form" onSubmit={onLogin}>
          <span className="demo-pill">Investor demo</span>
          <h1 className="admin-login__title">CLICKI demo admin</h1>
          <p className="muted-note demo-login-note">Test data only. Real database, uploads and payouts are not available here.</p>
          <label className="lead-form__field">
            <span className="lead-form__label">Login</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className="lead-form__field">
            <span className="lead-form__label">Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <p className="lead-form__errors" role="alert">{error}</p>}
          <button type="submit" className="btn btn--primary btn--block">Log in</button>
          <Link to="/" className="admin-login__back">Back to site</Link>
        </form>
      </main>
    );
  }

  return (
    <main className="admin page-light app-light ae-skip">
      <Helmet>
        <title>CLICKI - demo admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="admin-topbar">
        <button className="admin-topbar__burger" onClick={() => setNavOpen(true)} aria-label="Open menu" aria-expanded={navOpen}>
          <span />
          <span />
          <span />
        </button>
        <span className="admin-topbar__title">{NAV.find((n) => n.key === view)?.label || 'CLICKI demo'}</span>
        <button className="btn btn--ghost btn--sm" onClick={logout}>Log out</button>
      </header>

      <div className="admin-layout">
        {navOpen && <div className="admin-backdrop" onClick={() => setNavOpen(false)} />}
        <aside className={`admin-sidebar ${navOpen ? 'is-open' : ''}`}>
          <div className="admin-sidebar__head">
            <div className="admin-sidebar__brand">CLICKI demo</div>
            <button className="admin-sidebar__close" onClick={() => setNavOpen(false)} aria-label="Close menu">x</button>
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
          <button className="btn btn--ghost btn--sm admin-sidebar__logout" onClick={logout}>Log out</button>
        </aside>

        <div className="admin-main">
          <div className="demo-banner">
            <span className="demo-pill">Demo mode</span>
            <span>All screens are interactive, but they use local test data only.</span>
            {toast && <b>{toast}</b>}
          </div>

          {view === 'dashboard' && <Dashboard totals={totals} onAction={demoAction} />}
          {view === 'analytics' && <Analytics />}
          {view === 'briefs' && <Briefs onAction={demoAction} />}
          {view === 'review' && <Review onAction={demoAction} />}
          {view === 'creators' && <Creators onAction={demoAction} />}
          {view === 'businesses' && <Businesses onAction={demoAction} />}
          {view === 'payouts' && <Payouts onAction={demoAction} />}
          {view === 'content' && <Content onAction={demoAction} />}
          {view === 'settings' && <Settings onAction={demoAction} />}
        </div>
      </div>
    </main>
  );
}

function Dashboard({ totals, onAction }) {
  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Platform overview</h2>
        <button className="btn btn--ghost btn--sm" onClick={() => onAction('Data refreshed')}>Refresh</button>
      </div>
      <div className="kpi-grid">
        <Kpi tone="rose" icon="inbox" value={totals.leads} label="Leads" />
        <Kpi tone="green" icon="users" value={totals.creators} label="Creators" />
        <Kpi tone="violet" icon="chart" value={totals.views.toLocaleString('ru-RU')} label="Views" />
        <Kpi tone="amber" icon="wallet" value={`${Math.round(totals.payouts / 1000)}k KZT`} label="Payouts" />
      </div>
      <h3 className="admin-block__title admin-subhead">Recent leads</h3>
      <LeadTable rows={leads} />
    </section>
  );
}

function Analytics() {
  const max = Math.max(...monthly.map((d) => d.visits));
  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Traffic analytics <span className="an-live">demo</span></h2>
      <div className="admin-stats">
        <Stat label="Visits" value="12 740" />
        <Stat label="Unique" value="8 920" />
        <Stat label="Conversion" value="6.8%" />
      </div>
      <h3 className="admin-block__title admin-subhead">Visits over 14 days</h3>
      <div className="an-days">
        {monthly.map((d) => (
          <div key={d.day} className="an-day" title={`${d.day}: ${d.visits}`}>
            <span className="an-day__bar" style={{ height: `${Math.round((d.visits / max) * 100)}%` }} />
            <span className="an-day__label">{d.day}</span>
          </div>
        ))}
      </div>
      <div className="an-cols">
        <MiniTable title="Top pages" rows={[['/business', '4 280'], ['/creators', '3 710'], ['/', '2 940']]} />
        <MiniTable title="Sources" rows={[['TikTok', '3 120'], ['Instagram', '2 860'], ['Direct', '1 980']]} />
      </div>
    </section>
  );
}

function Briefs({ onAction }) {
  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Briefs</h2>
        <button className="btn btn--primary btn--sm" onClick={() => onAction('Draft brief created')}>Create brief</button>
      </div>
      <div className="bp-cards">
        {briefs.map((b) => (
          <div key={b.id} className="bp-card">
            <div className="bp-card__head">
              <b>{b.title}</b>
              <span className={`pf-status pf-status--${b.status === 'active' ? 'accepted' : b.status === 'review' ? 'rework' : 'pending'}`}>{b.status}</span>
            </div>
            <p className="creator-portal__muted">{b.platform} · slots {b.slots} · {b.views.toLocaleString('ru-RU')} views</p>
            <button className="btn btn--ghost btn--sm" onClick={() => onAction('Creator assignment saved')}>Assign creators</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Review({ onAction }) {
  const rows = [
    ['Aisulu N.', 'Summer coffee launch', 'ai_passed', '32 400'],
    ['Miras shortform', 'Fitness challenge', 'sent_to_business', '18 910'],
    ['Dana UGC', 'Delivery review', 'rework', '4 220'],
  ];
  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Video review</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Creator</th><th>Brief</th><th>Status</th><th>Views</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.join('-')}>
                <td data-label="Creator">{r[0]}</td>
                <td data-label="Brief">{r[1]}</td>
                <td data-label="Status"><span className={`pf-status pf-status--${r[2]}`}>{r[2]}</span></td>
                <td data-label="Views">{r[3]}</td>
                <td data-label="Actions"><button className="btn btn--ghost btn--sm" onClick={() => onAction('Decision logged')}>Approve</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Creators({ onAction }) {
  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Creators</h2>
        <button className="btn btn--primary btn--sm" onClick={() => onAction('Test creator added')}>Add creator</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>City</th><th>Trust</th><th>Videos</th><th>Views</th></tr></thead>
          <tbody>{creators.map((c) => <tr key={c.name}><td data-label="Name"><b>{c.name}</b></td><td data-label="City">{c.city}</td><td data-label="Trust">{c.trust}</td><td data-label="Videos">{c.videos}</td><td data-label="Views">{c.views.toLocaleString('ru-RU')}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function Businesses({ onAction }) {
  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Businesses</h2>
        <button className="btn btn--primary btn--sm" onClick={() => onAction('Test business added')}>Create account</button>
      </div>
      <LeadTable rows={leads.filter((l) => l.funnel === 'business')} />
    </section>
  );
}

function Payouts({ onAction }) {
  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Payouts</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Creator</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.creator}>
                <td data-label="Creator">{p.creator}</td>
                <td data-label="Amount">{p.amount.toLocaleString('ru-RU')} KZT</td>
                <td data-label="Status"><span className={`pf-status pf-status--${p.status}`}>{p.status}</span></td>
                <td data-label=""><button className="btn btn--ghost btn--sm" onClick={() => onAction('Payout marked in demo')}>Mark</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Content({ onAction }) {
  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Site content</h2>
        <button className="btn btn--primary btn--sm" onClick={() => onAction('Content saved')}>Save</button>
      </div>
      <div className="bp-cards">
        {contentItems.map((item) => (
          <div key={item.name} className="bp-card">
            <div className="bp-card__head"><b>{item.name}</b><span className="pf-badge">{item.type}</span></div>
            <p className="creator-portal__muted">Status: {item.status}</p>
            <button className="btn btn--ghost btn--sm" onClick={() => onAction('File selected in demo')}>Replace</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Settings({ onAction }) {
  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Platform settings</h2>
      <div className="pf-form">
        <input value="Minimum credited views: 1000" readOnly />
        <input value="Payout threshold: 50 000 KZT" readOnly />
        <input value="TikTok sync: connected through OAuth" readOnly />
        <button className="btn btn--primary btn--sm" onClick={() => onAction('Settings saved in demo')}>Save</button>
      </div>
    </section>
  );
}

function LeadTable({ rows }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>Type</th><th>Data</th><th>Page</th><th>Time</th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={`${l.name}-${l.createdAt}`}>
              <td data-label="Type"><span className={`lead-pill lead-pill--${l.funnel === 'business' ? 'biz' : 'creator'}`}>{l.funnel === 'business' ? 'Business' : 'Creator'}</span></td>
              <td data-label="Data"><b>{l.name}</b><div className="muted-cell">{l.contact}</div></td>
              <td data-label="Page">{l.page}</td>
              <td data-label="Time">{new Date(l.createdAt).toLocaleString('ru-RU')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniTable({ title, rows }) {
  return (
    <div>
      <h3 className="admin-block__title admin-subhead">{title}</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <tbody>{rows.map(([name, value]) => <tr key={name}><td data-label={title}>{name}</td><td className="muted-cell" data-label="Value">{value}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

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
