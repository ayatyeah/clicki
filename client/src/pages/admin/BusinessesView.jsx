import { useState, useEffect, Fragment } from 'react';
import { useToast } from '../../components/Toast.jsx';
import ConfirmDelete from '../../components/ConfirmDelete.jsx';
import { contactHref, normalizeContact } from '../../lib/contact.js';
import { BriefRead, briefStatus } from './BriefsView.jsx';

const EMPTY_FORM = { name: '', company: '', email: '', contact: '', password: '' };

/* ---------------- Businesses (accounts) ---------------- */
export function BusinessesView({ authFetch }) {
  const toast = useToast();
  const [businesses, setBusinesses] = useState([]);
  const [briefs, setBriefs] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    const r = await (await authFetch('/api/admin/businesses')).json();
    setBusinesses(r.businesses || []);
    // The brief history per business comes from the list the Брифы tab already
    // serves — it carries every field, so no extra endpoint or query is needed.
    const br = await (await authFetch('/api/admin/briefs')).json();
    setBriefs(br.briefs || []);
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line
  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const create = async () => {
    if (!form.name || !form.email || !form.password) return;
    setError('');
    if (!normalizeContact(form.contact)) return setError('Контакты: телефон (+7 707 123 45 67) или Telegram (@username)');
    setBusy(true);
    const res = await authFetch('/api/admin/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || d.ok === false) return setError((d.errors && d.errors[0]) || 'Ошибка');
    setForm(EMPTY_FORM);
    toast.success('Аккаунт бизнеса создан');
    load();
  };

  const remove = async (id) => {
    setError('');
    const res = await authFetch(`/api/admin/businesses/${id}/delete`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const msg = (d.errors && d.errors[0]) || 'Не удалось удалить';
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success('Аккаунт удалён');
    load();
  };

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Бизнесы ({businesses.length})</h2>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Создай аккаунт бизнесу (выдай email и пароль) — под этими данными бренд войдёт в кабинет.
        Бренды также могут регистрироваться сами со страницы входа. Контакты обязательны — по клику
        в таблице открывается звонок или чат в Telegram.
      </p>
      <div className="pf-form">
        <input placeholder="Имя контакта" value={form.name} onChange={(e) => setF('name', e.target.value)} />
        <input placeholder="Компания (по желанию)" value={form.company} onChange={(e) => setF('company', e.target.value)} />
        <input placeholder="Контакты — телефон или @username в Telegram" value={form.contact} onChange={(e) => setF('contact', e.target.value)} />
        <div className="pf-row">
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} />
          <input placeholder="Пароль (мин. 8)" value={form.password} onChange={(e) => setF('password', e.target.value)} />
        </div>
        {error && <p className="creator-portal__err" style={{ margin: 0 }}>{error}</p>}
        <button className="btn btn--primary btn--sm" onClick={create} disabled={busy}>
          {busy ? 'Создаю…' : 'Создать бизнес'}
        </button>
      </div>

      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Бизнес</th>
              <th>Контакты</th>
              <th>Email (логин)</th>
              <th>Брифов</th>
              <th>Документы</th>
              <th>Создан</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <Fragment key={b.id}>
                <tr>
                  <td data-label="Бизнес">
                    <b>{b.company || b.name}</b>
                    {b.company && <div style={{ fontSize: '0.8rem', color: 'var(--fog)' }}>{b.name}</div>}
                  </td>
                  <td data-label="Контакты"><BusinessContact business={b} authFetch={authFetch} onSaved={load} /></td>
                  <td data-label="Email"><BusinessCredentials business={b} authFetch={authFetch} onSaved={load} /></td>
                  <td data-label="Брифов">
                    {b.briefs
                      ? (
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setOpenId((id) => (id === b.id ? null : b.id))}
                          aria-expanded={openId === b.id}
                        >
                          {b.briefs} {openId === b.id ? '▲' : '▼'}
                        </button>
                      )
                      : <span className="muted-cell">0</span>}
                  </td>
                  <td data-label="Документы">
                    {b.legal_accepted_version
                      ? <span className="tt-chip tt-chip--on" title={`Принято: ${b.legal_accepted_version}`}>✓</span>
                      : <span className="tt-chip" title="Согласие на ПДн ещё не принято">—</span>}
                  </td>
                  <td className="muted-cell" data-label="Создан">{b.created_at ? new Date(b.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                  <td data-label="Действия">
                    <ConfirmDelete onConfirm={() => remove(b.id)} />
                  </td>
                </tr>
                {openId === b.id && (
                  <tr className="biz-briefs__row">
                    <td colSpan={6}>
                      <BusinessBriefs briefs={briefs.filter((x) => x.business_id === b.id)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!businesses.length && <tr><td colSpan={6} className="admin-table__empty">Бизнесов пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Everything this business ever sent us, newest first — what they asked for and
 * how each one ended up. Reuses the moderation queue's reader so the full brief
 * is one click away here too, rather than only next to the publish buttons.
 */
function BusinessBriefs({ briefs }) {
  const [openId, setOpenId] = useState(null);
  if (!briefs.length) return <p className="muted-note" style={{ textAlign: 'left', margin: 0 }}>Брифов пока нет.</p>;
  return (
    <div className="biz-briefs">
      {briefs.map((b) => {
        const { label, cls } = briefStatus(b.status);
        const open = openId === b.id;
        return (
          <div className="biz-briefs__item" key={b.id}>
            <div className="biz-briefs__head">
              <b>{b.title}</b>
              <span className={`pf-status pf-status--${cls}`}>{label}</span>
              <span className="muted-cell">
                {b.created_at ? new Date(b.created_at).toLocaleDateString('ru-RU') : '—'}
                {b.ai_score != null ? ` · ИИ ${b.ai_score}/100` : ''}
              </span>
              <button className="btn btn--ghost btn--sm" onClick={() => setOpenId(open ? null : b.id)} aria-expanded={open}>
                {open ? 'Свернуть' : 'Читать'}
              </button>
            </div>
            {open && <BriefRead b={b} />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The contact cell: one click to call or open Telegram, plus inline editing —
 * accounts created before contacts were mandatory show "не указаны" here until
 * an operator (or the brand itself, from its profile) fills one in.
 */
function BusinessContact({ business, authFetch, onSaved }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(business.contact || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr('');
    if (!normalizeContact(value)) return setErr('Телефон или @username');
    setBusy(true);
    const res = await authFetch(`/api/admin/businesses/${business.id}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: value }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || d.ok === false) return setErr((d.errors && d.errors[0]) || 'Ошибка');
    setOpen(false);
    toast.success('Контакты обновлены');
    onSaved();
  };

  if (open) {
    return (
      <div className="pf-actions">
        <input placeholder="+7 707 … или @username" value={value} onChange={(e) => setValue(e.target.value)} />
        {err && <span className="creator-portal__err" style={{ fontSize: '0.78rem' }}>{err}</span>}
        <div className="pf-row">
          <button className="btn btn--primary btn--sm" onClick={save} disabled={busy}>{busy ? '…' : 'Сохранить'}</button>
          <button className="btn btn--ghost btn--sm" onClick={() => { setValue(business.contact || ''); setErr(''); setOpen(false); }}>Отмена</button>
        </div>
      </div>
    );
  }
  const href = contactHref(business.contact);
  // Telegram opens in a new tab; a tel: dialer must not, or desktop is left
  // staring at a blank one.
  const linkProps = href?.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <div className="pf-actions">
      {href
        ? <a href={href} {...linkProps} style={{ fontSize: '0.85rem' }}>{business.contact}</a>
        : <span className="creator-portal__err" style={{ fontSize: '0.85rem' }}>не указаны</span>}
      <button className="btn btn--ghost btn--sm" onClick={() => { setValue(business.contact || ''); setErr(''); setOpen(true); }}>
        {href ? 'Изменить' : 'Добавить'}
      </button>
    </div>
  );
}

function BusinessCredentials({ business, authFetch, onSaved }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(business.email || '');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true);
    setErr('');
    const res = await authFetch(`/api/admin/businesses/${business.id}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: p }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || d.ok === false) return setErr((d.errors && d.errors[0]) || 'Ошибка');
    setP('');
    setOpen(false);
    onSaved();
  };

  if (!open) {
    return (
      <div className="pf-actions">
        <span style={{ fontSize: '0.85rem' }}>{business.email}</span>
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>Сменить пароль</button>
      </div>
    );
  }
  return (
    <div className="pf-actions">
      <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="text" placeholder="Новый пароль" value={p} onChange={(e) => setP(e.target.value)} />
      {err && <span className="creator-portal__err" style={{ fontSize: '0.78rem' }}>{err}</span>}
      <div className="pf-row">
        <button className="btn btn--primary btn--sm" onClick={save} disabled={busy}>{busy ? '…' : 'Сохранить'}</button>
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Отмена</button>
      </div>
    </div>
  );
}
