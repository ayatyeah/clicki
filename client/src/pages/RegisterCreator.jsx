import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { API_BASE } from '../lib/config.js';
import { getRecaptchaToken } from '../lib/api.js';

// Same key the creator cabinet reads on mount — writing it here logs the new
// creator straight in, and /creator opens into onboarding (test → niche → guide).
const KEY = 'clicki_creator_token';

/**
 * Public self-service creator sign-up. Share /registration_creators (optionally
 * with ?ref=<creatorId> from a friend link): the creator picks their own login
 * and password, gets an active account, and lands in the cabinet's onboarding.
 */
export default function RegisterCreator() {
  const navigate = useNavigate();
  const refId = new URLSearchParams(window.location.search).get('ref');
  const [f, setF] = useState({ name: '', email: '', contact: '', telegram: '', country: '', city: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.name.trim()) return setError('Укажи ФИО');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return setError('Укажи корректную почту');
    if (!f.contact.trim()) return setError('Укажи телефон');
    if (!/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(f.telegram.trim().replace(/^(https?:\/\/)?(www\.)?t\.me\//, '')))
      return setError('Telegram укажи в виде @username');
    if (!f.country.trim()) return setError('Укажи страну');
    if (!f.city.trim()) return setError('Укажи город');
    if (f.username.trim().length < 3) return setError('Логин не короче 3 символов');
    if (f.password.length < 8) return setError('Пароль не короче 8 символов');
    setBusy(true);
    try {
      const recaptchaToken = await getRecaptchaToken('register_creator');
      const res = await fetch(`${API_BASE}/api/creator/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, referred_by: refId ? Number(refId) : undefined, recaptchaToken }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || 'Не удалось зарегистрироваться');
      localStorage.setItem(KEY, d.token);
      navigate('/creator');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="creator-portal page-light app-light ae-skip">
      <Seo
        title="Регистрация креатора — CLICKI"
        path="/registration_creators"
        description="Создай аккаунт креатора CLICKI и начни зарабатывать на коротких видео."
        noindex
      />
      <div className="container creator-portal__inner">
        <div className="creator-portal__head">
          <Link to="/" className="creator-portal__brand"><img className="brand-mark" src="/logo-mark.png" alt="" />CLICKI</Link>
          <span className="creator-portal__tag">кабинет креатора</span>
        </div>
        <div className="mascot-avatar"><img src="/mascot-hood.jpg" alt="CLICKI" /></div>
        <h1 className="creator-portal__title">Регистрация креатора</h1>
        <p className="creator-portal__muted">
          Создай аккаунт за минуту. Логин и пароль придумай сам — они понадобятся, чтобы заходить в кабинет.
        </p>
        <form className="creator-portal__card" onSubmit={submit} noValidate>
          <input name="name" placeholder="ФИО" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} />
          <input name="email" type="email" inputMode="email" placeholder="Почта" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          <input name="contact" placeholder="Телефон" type="tel" inputMode="tel" autoComplete="tel" value={f.contact} onChange={(e) => set('contact', e.target.value)} />
          <input name="telegram" placeholder="Telegram — @username" autoComplete="off" value={f.telegram} onChange={(e) => set('telegram', e.target.value)} />
          <input name="country" placeholder="Страна" autoComplete="country-name" value={f.country} onChange={(e) => set('country', e.target.value)} />
          <input name="city" placeholder="Город" autoComplete="address-level2" value={f.city} onChange={(e) => set('city', e.target.value)} />
          <input name="username" placeholder="Придумай логин (мин. 3)" autoComplete="username" value={f.username} onChange={(e) => set('username', e.target.value)} />
          <input name="password" type="password" placeholder="Придумай пароль (мин. 8)" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} />
          {error && <p className="creator-portal__err">{error}</p>}
          <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Создаю…' : 'Создать аккаунт →'}</button>
          <p className="creator-portal__muted creator-portal__switch">
            Уже есть аккаунт?{' '}
            <Link to="/creator" className="creator-portal__link">Войти</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
