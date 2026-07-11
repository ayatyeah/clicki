import { useState, useEffect } from 'react';
import { SITE_URL } from '../../lib/config.js';
import { useToast } from '../../components/Toast.jsx';
import CopyButton from '../../components/CopyButton.jsx';
import ConfirmDelete from '../../components/ConfirmDelete.jsx';

const STAR_D = 'M12 2.6l2.85 5.77 6.37.93-4.61 4.49 1.09 6.35L12 17.77l-5.7 3l1.09-6.35-4.61-4.49 6.37-.93z';

/** 5-star rating with fractional fill (0–5). */
function Stars({ value = 0 }) {
  return (
    <span className="stars" title={`${Number(value).toFixed(1)} из 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const f = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="star">
            <svg className="star__bg" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR_D} /></svg>
            <svg className="star__fg" viewBox="0 0 24 24" aria-hidden="true" style={{ clipPath: `inset(0 ${100 - f * 100}% 0 0)` }}><path d={STAR_D} /></svg>
          </span>
        );
      })}
      <span className="stars__num">{Number(value).toFixed(1)}</span>
    </span>
  );
}

const BAN_OPTIONS = [
  { days: 1, label: '1 день' },
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: null, label: 'Навсегда' },
];

/** Temporary/permanent ban control for one creator: a "Бан" button that opens
 * a duration menu, or, when already banned, the end date + a "Разбанить" button. */
function BanControl({ creator, authFetch, onDone }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const bannedUntil = creator.banned_until ? new Date(creator.banned_until) : null;
  const isBanned = creator.status === 'banned' && (!bannedUntil || bannedUntil > new Date());

  const ban = async (days) => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/creators/${creator.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(days == null ? { permanent: true } : { days }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).errors?.[0] || 'Не удалось забанить');
      toast.success(days == null ? 'Забанен навсегда' : `Бан на ${days} дн.`);
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const unban = async () => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/creators/${creator.id}/unban`, { method: 'POST' });
      if (!res.ok) throw new Error('Не удалось разбанить');
      toast.success('Разбанен');
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (isBanned) {
    const until = bannedUntil ? bannedUntil.toLocaleDateString('ru-RU') : 'навсегда';
    return (
      <div className="admin-ban">
        <span className="pf-status pf-status--rejected">бан · {until}</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={unban} disabled={busy}>Разбанить</button>
      </div>
    );
  }
  if (!open) {
    return <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(true)} disabled={busy}>Бан</button>;
  }
  return (
    <div className="admin-ban__menu">
      {BAN_OPTIONS.map((o) => (
        <button key={o.label} type="button" className="btn btn--sm" onClick={() => ban(o.days)} disabled={busy}>{o.label}</button>
      ))}
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Отмена</button>
    </div>
  );
}

/* ---------------- Creators ---------------- */
export function CreatorsView({ authFetch }) {
  const toast = useToast();
  const [creators, setCreators] = useState([]);
  const [form, setForm] = useState({ name: '', contact: '', username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    const r = await (await authFetch('/api/admin/creators')).json();
    setCreators(r.creators || []);
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line
  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const create = async () => {
    if (!form.name) return;
    setBusy(true);
    setError('');
    const res = await authFetch('/api/admin/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError((d.errors && d.errors[0]) || 'Ошибка');
    setForm({ name: '', contact: '', username: '', password: '' });
    load();
  };

  const toggle = async (id, field, value) => {
    setError('');
    const res = await authFetch(`/api/admin/creators/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data.errors && data.errors[0]) || 'Не удалось изменить статус');
      return;
    }
    load();
  };

  const remove = async (id) => {
    setError('');
    const res = await authFetch(`/api/admin/creators/${id}/delete`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = (data.errors && data.errors[0]) || 'Не удалось удалить';
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success('Креатор удалён');
    load();
  };

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Креаторы ({creators.length})</h2>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Создай аккаунт креатору (выдай логин и пароль) — под этими данными он войдёт в кабинет.
        Заявки с сайта приходят со статусом <b>pending</b>: выдай им доступ кнопкой «Выдать».
      </p>

      <BulkRegister authFetch={authFetch} onDone={load} />

      <div className="pf-form">
        <input placeholder="Имя" value={form.name} onChange={(e) => setF('name', e.target.value)} />
        <input placeholder="Телефон / Telegram" value={form.contact} onChange={(e) => setF('contact', e.target.value)} />
        <div className="pf-row">
          <input placeholder="Логин (мин. 3)" value={form.username} onChange={(e) => setF('username', e.target.value)} />
          <input placeholder="Пароль (мин. 8)" value={form.password} onChange={(e) => setF('password', e.target.value)} />
        </div>
        {error && <p className="creator-portal__err" style={{ margin: 0 }}>{error}</p>}
        <button className="btn btn--primary btn--sm" onClick={create} disabled={busy}>
          {busy ? 'Создаю…' : 'Создать креатора'}
        </button>
      </div>

      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Креатор</th>
              <th>Рейтинг</th>
              <th>Контакт</th>
              <th>Доступ (логин)</th>
              <th>XP / Trust / Стрик</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {creators.map((c) => (
              <tr key={c.id}>
                <td data-label="Креатор">
                  <b>{c.name}</b> {c.founding && <span className="pf-badge">Founding</span>}
                  <div style={{ fontSize: '0.8rem', color: 'var(--fog)' }}>{c.socials || ''}</div>
                </td>
                <td data-label="Рейтинг"><Stars value={c.rating || 0} /></td>
                <td data-label="Контакт">{c.contact}</td>
                <td data-label="Доступ">
                  <Credentials creator={c} authFetch={authFetch} onSaved={load} />
                </td>
                <td data-label="XP / Trust / Стрик">{c.xp} / {c.trust_score} / {c.streak}</td>
                <td data-label="Статус">
                  <select value={c.status} onChange={(e) => toggle(c.id, 'status', e.target.value)}>
                    <option value="pending">pending</option>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="banned">banned</option>
                  </select>
                </td>
                <td data-label="Действия">
                  <div className="admin-row-actions">
                    <BanControl creator={c} authFetch={authFetch} onDone={load} />
                    <ConfirmDelete onConfirm={() => remove(c.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {!creators.length && <tr><td colSpan={7} className="admin-table__empty">Креаторов пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Bulk creator registration — paste a list, get accounts with auto-generated
 * logins/passwords back in one table to hand out. Built because onboarding 50+
 * people one form at a time is painful.
 *
 * Input: one creator per line, "Имя" or "Имя, контакт". Login and password are
 * generated server-side (login can't collide; password is short & readable).
 */
function BulkRegister({ authFetch, onDone }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { created: [...], errors: [...] }

  // "Имя, контакт" | "Имя; контакт" | "Имя\tконтакт" | "Имя" → { name, contact }
  const parse = (raw) =>
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,;\t]/).map((s) => s.trim());
        return { name: parts[0], contact: parts[1] || undefined };
      })
      .filter((r) => r.name);

  const parsed = parse(text);

  const submit = async () => {
    if (!parsed.length) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await authFetch('/api/admin/creators/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creators: parsed }),
      });
      const d = await res.json();
      if (!res.ok || d.ok === false) throw new Error(d.errors?.[0] || 'Ошибка');
      setResult(d);
      setText('');
      toast.success(`Создано ${d.created.length} креаторов`);
      onDone?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Ready-to-send handout text: one block per creator with login/password + link.
  const handout = (result?.created || [])
    .map((c) => `${c.name}\nВход в кабинет CLICKI: ${SITE_URL}/creator\nЛогин: ${c.username}\nПароль: ${c.password}`)
    .join('\n\n');

  return (
    <div className="bulk-reg">
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen((v) => !v)}>
        {open ? 'Скрыть массовую регистрацию' : '👥 Массовая регистрация'}
      </button>

      {open && (
        <div className="bulk-reg__body">
          <p className="muted-note" style={{ textAlign: 'left' }}>
            Вставь список — по одному креатору на строку. Формат: <b>Имя</b> или <b>Имя, контакт</b> (телефон/Telegram).
            Логин и пароль сгенерируются автоматически.
          </p>
          <textarea
            className="bulk-reg__input"
            rows={6}
            placeholder={'Аружан, @aruzhan\nДана Ким, +7 701 234 56 78\nАлибек'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="pf-actions">
            <button className="btn btn--primary btn--sm" onClick={submit} disabled={busy || !parsed.length}>
              {busy ? 'Создаю…' : parsed.length ? `Создать ${parsed.length}` : 'Создать'}
            </button>
            {parsed.length > 0 && <span className="muted-note">распознано строк: {parsed.length}</span>}
          </div>

          {result && (
            <div className="bulk-reg__result">
              <div className="admin-panel__head">
                <h3 className="admin-block__title" style={{ fontSize: '1rem' }}>
                  Готово: {result.created.length} создано{result.errors.length ? `, ${result.errors.length} с ошибкой` : ''}
                </h3>
                {result.created.length > 0 && <CopyButton value={handout} label="Скопировать всё для рассылки" />}
              </div>
              <p className="muted-note" style={{ textAlign: 'left' }}>
                ⚠️ Пароли показаны один раз — скопируй и раздай креаторам сейчас.
              </p>
              {result.created.length > 0 && (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Имя</th><th>Логин</th><th>Пароль</th><th>Контакт</th></tr></thead>
                    <tbody>
                      {result.created.map((c) => (
                        <tr key={c.id}>
                          <td data-label="Имя">{c.name}</td>
                          <td data-label="Логин"><code>{c.username}</code></td>
                          <td data-label="Пароль"><code>{c.password}</code></td>
                          <td data-label="Контакт">{c.contact || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.errors.length > 0 && (
                <ul className="bulk-reg__errors">
                  {result.errors.map((e, i) => (
                    <li key={i} className="creator-portal__err">Строка {e.line}{e.name ? ` (${e.name})` : ''}: {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Credentials({ creator, authFetch, onSaved }) {
  const [open, setOpen] = useState(false);
  const [u, setU] = useState(creator.username || '');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true);
    setErr('');
    const res = await authFetch(`/api/admin/creators/${creator.id}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setErr((d.errors && d.errors[0]) || 'Ошибка');
    setP('');
    setOpen(false);
    onSaved();
  };

  if (!open) {
    return (
      <div className="pf-actions">
        {creator.username ? (
          <span style={{ fontSize: '0.85rem' }}>{creator.username}</span>
        ) : (
          <span style={{ fontSize: '0.82rem', color: 'var(--fog)' }}>нет доступа</span>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>
          {creator.username ? 'Сменить пароль' : 'Выдать'}
        </button>
      </div>
    );
  }
  return (
    <div className="pf-actions">
      <input placeholder="Логин" value={u} onChange={(e) => setU(e.target.value)} />
      <input type="text" placeholder="Новый пароль" value={p} onChange={(e) => setP(e.target.value)} />
      {err && <span className="creator-portal__err" style={{ fontSize: '0.78rem' }}>{err}</span>}
      <div className="pf-row">
        <button className="btn btn--primary btn--sm" onClick={save} disabled={busy}>{busy ? '…' : 'Сохранить'}</button>
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Отмена</button>
      </div>
    </div>
  );
}
