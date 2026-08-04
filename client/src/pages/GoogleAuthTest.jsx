import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { API_BASE } from '../lib/config.js';
import '../styles/google-test.css';

/**
 * /google-test — тестовая консоль входа через Google. Нигде в навигации не
 * упоминается и закрыта от индексации (noindex): сюда попадают только по
 * прямой ссылке. Полностью изолирована от боевых аккаунтов — свой бекенд-контур
 * /api/auth/google/*, своя таблица google_test_users, свой ключ в localStorage.
 *
 * Client id приезжает с сервера (GET /config), а не из VITE-переменной: так
 * включение/выключение фичи — это один env на сервере, без пересборки клиента.
 */

const TOKEN_KEY = 'clicki_google_test_token';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

// Скрипт Google Identity Services грузим один раз на вкладку.
let gsiPromise = null;
function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => {
      gsiPromise = null; // дать повторной попытке шанс после сетевой ошибки
      reject(new Error('Не удалось загрузить скрипт Google (accounts.google.com)'));
    };
    document.head.appendChild(s);
  });
  return gsiPromise;
}

const getToken = () => window.localStorage.getItem(TOKEN_KEY) || '';
const setToken = (t) => window.localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => window.localStorage.removeItem(TOKEN_KEY);

export default function GoogleAuthTest() {
  const [config, setConfig] = useState({ state: 'loading' }); // loading | ready | error
  const [user, setUser] = useState(null);
  const [isNew, setIsNew] = useState(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [log, setLog] = useState([]);
  const btnRef = useRef(null);
  // Колбэк Google создаётся один раз при initialize() — актуальное значение
  // чекбокса доносим до него через ref, а не через замыкание.
  const consentRef = useRef(false);
  consentRef.current = consent;

  const addLog = useCallback((kind, msg) => {
    const t = new Date().toLocaleTimeString('ru-RU');
    setLog((prev) => [...prev, { t, kind, msg }].slice(-40));
  }, []);

  // Шаг 1: конфиг с сервера (включена ли фича + публичный client id).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        addLog('info', 'Запрашиваю /api/auth/google/config…');
        const res = await fetch(`${API_BASE}/api/auth/google/config`);
        const data = await res.json();
        if (!alive) return;
        if (!data.ok) throw new Error('Сервер ответил ошибкой');
        setConfig({ state: 'ready', enabled: data.enabled, clientId: data.clientId });
        addLog(data.enabled ? 'ok' : 'warn', data.enabled
          ? `Конфиг получен, client id: …${String(data.clientId).slice(-28)}`
          : 'Вход через Google выключен: на сервере нет GOOGLE_CLIENT_ID');
      } catch (err) {
        if (!alive) return;
        setConfig({ state: 'error', message: err.message });
        addLog('err', `Конфиг не получен: ${err.message}`);
      }
    })();
    return () => { alive = false; };
  }, [addLog]);

  // Отправка credential (JWT от Google) на наш бекенд.
  const submitCredential = useCallback(async (credential) => {
    setBusy(true);
    addLog('info', 'Google вернул credential, отправляю на сервер…');
    try {
      const res = await fetch(`${API_BASE}/api/auth/google/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, marketingConsent: consentRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.errors?.[0] || `Ошибка ${res.status}`);
      setToken(data.token);
      setUser(data.user);
      setIsNew(data.isNew);
      addLog('ok', data.isNew
        ? `Создан новый тестовый аккаунт: ${data.user.email || 'без email'}`
        : `Повторный вход (${data.user.loginsCount}-й): ${data.user.email || 'без email'}`);
    } catch (err) {
      addLog('err', `Вход не удался: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, [addLog]);

  // Шаг 2: когда конфиг готов и Google включён — грузим GIS и рисуем кнопку.
  useEffect(() => {
    if (config.state !== 'ready' || !config.enabled) return;
    let alive = true;
    (async () => {
      try {
        addLog('info', 'Загружаю скрипт Google Identity Services…');
        const google = await loadGsi();
        if (!alive || !btnRef.current) return;
        google.accounts.id.initialize({
          client_id: config.clientId,
          callback: (resp) => submitCredential(resp.credential),
        });
        btnRef.current.innerHTML = ''; // повторный заход на страницу не должен дублировать кнопку
        google.accounts.id.renderButton(btnRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          locale: 'ru',
          width: 280,
        });
        addLog('ok', 'Кнопка Google готова — можно входить');
      } catch (err) {
        addLog('err', err.message);
      }
    })();
    return () => { alive = false; };
  }, [config, submitCredential, addLog]);

  // Если после перезагрузки страницы в localStorage остался токен — проверяем его.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (async () => {
      addLog('info', 'Нашёл сохранённый токен — проверяю сессию…');
      try {
        const res = await fetch(`${API_BASE}/api/auth/google/test/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.errors?.[0] || 'сессия истекла');
        setUser(data.user);
        addLog('ok', `Сессия жива: ${data.user.email || data.user.name || 'аккаунт'}`);
      } catch (err) {
        clearToken();
        addLog('warn', `Старая сессия не подошла (${err.message}) — токен очищен`);
      }
    })();
  }, [addLog]);

  const checkMe = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/google/test/me`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.errors?.[0] || `Ошибка ${res.status}`);
      setUser(data.user);
      addLog('ok', 'GET /test/me: сессия действительна ✓');
    } catch (err) {
      addLog('err', `GET /test/me: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/auth/google/test/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    } catch { /* выход не должен падать из-за сети */ }
    clearToken();
    setUser(null);
    setIsNew(null);
    setBusy(false);
    addLog('info', 'Вышел: токен удалён локально и на сервере');
  };

  const cfgRow = (label, ok, detail) => (
    <div className="gtest-check">
      <span className={`gtest-check__dot ${ok ? 'is-ok' : 'is-bad'}`} aria-hidden="true" />
      <span className="gtest-check__label">{label}</span>
      {detail ? <span className="gtest-check__detail">{detail}</span> : null}
    </div>
  );

  return (
    <main className="gtest">
      <Seo
        title="CLICKI — тест входа через Google"
        description="Служебная страница для проверки Google OAuth."
        path="/google-test"
        noindex
      />

      <div className="gtest__inner">
        <header className="gtest__head">
          <div>
            <p className="gtest__eyebrow">Служебная страница · не для пользователей</p>
            <h1 className="gtest__title">Вход через Google — тест</h1>
            <p className="gtest__lead">
              Изолированный контур: отдельная таблица <code>google_test_users</code>, отдельные
              токены. Боевые аккаунты креаторов и бизнеса не затрагиваются.
            </p>
          </div>
          <Link to="/" className="gtest__home">← на главную</Link>
        </header>

        <section className="gtest-card">
          <h2 className="gtest-card__title">1 · Статус</h2>
          {config.state === 'loading' && <p className="gtest-muted">Загружаю конфигурацию…</p>}
          {config.state === 'error' && cfgRow('Сервер /api/auth/google/config', false, config.message)}
          {config.state === 'ready' && (
            <>
              {cfgRow('API отвечает', true)}
              {cfgRow(
                'GOOGLE_CLIENT_ID задан на сервере',
                config.enabled,
                config.enabled ? `…${String(config.clientId).slice(-28)}` : 'добавьте переменную и перезапустите сервер'
              )}
            </>
          )}
        </section>

        <section className="gtest-card">
          <h2 className="gtest-card__title">2 · Вход</h2>
          {config.state === 'ready' && config.enabled ? (
            <>
              <label className="gtest-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Соглашаюсь получать email-рассылку CLICKI (необязательно — фиксируем согласие
                  для будущих рассылок)
                </span>
              </label>
              <div className="gtest-btn-wrap">
                <div ref={btnRef} className="gtest-gbtn" />
                {busy && <span className="gtest-muted">Обмениваюсь данными с сервером…</span>}
              </div>
            </>
          ) : (
            <div className="gtest-setup">
              <p>Кнопка появится, когда на сервере будет задан <code>GOOGLE_CLIENT_ID</code>:</p>
              <ol>
                <li>Получите OAuth Client ID (Web) в Google Cloud Console — см. GOOGLE-CLOUD-SETUP.md.</li>
                <li>Локально: строка <code>GOOGLE_CLIENT_ID=…</code> в <code>server/.env</code> и перезапуск сервера.</li>
                <li>Прод: DigitalOcean → App → Settings → Environment Variables → <code>GOOGLE_CLIENT_ID</code>.</li>
              </ol>
            </div>
          )}
        </section>

        {user && (
          <section className="gtest-card">
            <h2 className="gtest-card__title">3 · Результат</h2>
            <div className="gtest-user">
              {user.avatarUrl ? (
                <img className="gtest-user__avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="gtest-user__avatar gtest-user__avatar--empty" aria-hidden="true">?</div>
              )}
              <div className="gtest-user__meta">
                <p className="gtest-user__name">{user.name || 'Без имени'}</p>
                <p className="gtest-user__email">
                  {user.email || '—'}
                  {user.emailVerified && <span className="gtest-badge gtest-badge--green">email подтверждён Google</span>}
                </p>
                <p className="gtest-user__facts">
                  {isNew === true && <span className="gtest-badge">новый аккаунт</span>}
                  {isNew === false && <span className="gtest-badge">повторный вход</span>}
                  <span className="gtest-badge">входов: {user.loginsCount}</span>
                  <span className={`gtest-badge ${user.marketingConsent ? 'gtest-badge--green' : ''}`}>
                    рассылка: {user.marketingConsent ? 'согласие есть' : 'нет согласия'}
                  </span>
                </p>
              </div>
            </div>
            <div className="gtest-actions">
              <button className="gtest-btn" onClick={checkMe} disabled={busy}>Проверить сессию (/me)</button>
              <button className="gtest-btn gtest-btn--ghost" onClick={logout} disabled={busy}>Выйти</button>
            </div>
          </section>
        )}

        <section className="gtest-card">
          <h2 className="gtest-card__title">Журнал</h2>
          {log.length === 0 ? (
            <p className="gtest-muted">Пока пусто.</p>
          ) : (
            <ul className="gtest-log">
              {log.map((l, i) => (
                <li key={i} className={`gtest-log__row is-${l.kind}`}>
                  <span className="gtest-log__time">{l.t}</span>
                  <span>{l.msg}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="gtest-foot">
          Собранные email лежат в таблице <code>google_test_users</code> (админ-эндпоинт:{' '}
          <code>GET /api/auth/google/test/users</code>) — это заготовка базы для рассылок.
        </p>
      </div>
    </main>
  );
}
