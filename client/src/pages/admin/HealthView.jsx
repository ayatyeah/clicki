import { useCallback, useEffect, useState } from 'react';
import { Stat, Kpi } from './ui.jsx';

/**
 * Site health: one screen answering "is the platform alive and what is it doing
 * right now" — accounts, who is online, the video pipeline, money owed, traffic,
 * and the runtime itself.
 *
 * Auto-refreshes so it can be left open on a second monitor. Data comes from
 * GET /api/admin/health (a single round-trip of concurrent aggregates).
 */

const REFRESH_MS = 30_000;

const num = (v) => Number(v || 0).toLocaleString('ru-RU');
const money = (v) => `${Math.round(Number(v || 0)).toLocaleString('ru-RU')} ₸`;

/** "3 ч 12 мин" — an uptime a human can read at a glance. */
function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d} д ${h} ч`;
  if (h) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'только что';
  return `${Math.floor(diff / 60)} мин назад`;
}

export default function HealthView({ authFetch }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tg, setTg] = useState(null); // Telegram self-test result
  const [tgBusy, setTgBusy] = useState(false);

  const testTelegram = useCallback(async () => {
    setTgBusy(true);
    try {
      const res = await authFetch('/api/admin/notify-test', { method: 'POST' });
      setTg(await res.json());
    } catch (err) {
      setTg({ ok: false, error: err.message });
    } finally {
      setTgBusy(false);
    }
  }, [authFetch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/health');
      const body = await res.json();
      if (!res.ok || body.ok === false) throw new Error(body.errors?.[0] || `Ошибка ${res.status}`);
      setData(body);
      setError('');
    } catch (err) {
      // Keep the last good snapshot on screen — a blank page is worse than a
      // slightly stale one, and the operator needs to know it went stale.
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!data && !error) {
    return (
      <section className="admin-block">
        <h2 className="admin-block__title">Состояние сайта</h2>
        <div className="bp-cards">
          <div className="bp-card bp-card--skeleton" aria-hidden="true" />
          <div className="bp-card bp-card--skeleton" aria-hidden="true" />
          <div className="bp-card bp-card--skeleton" aria-hidden="true" />
        </div>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="admin-block">
        <h2 className="admin-block__title">Состояние сайта</h2>
        <div className="admin-placeholder">Не удалось загрузить: {error}</div>
        <button className="btn btn--ghost btn--sm" onClick={load}>Повторить</button>
      </section>
    );
  }

  const { creators, businesses, briefs, submissions, leads, payouts, traffic, referrals, onlineNow, system } = data;
  const dbSlow = system.dbLatencyMs > 200;
  const poolTight = system.pool.waiting > 0;

  return (
    <>
      <section className="admin-block">
        <div className="admin-panel__head">
          <h2 className="admin-block__title">
            Состояние сайта{' '}
            <span className="creator-portal__muted">— обновляется каждые 30 сек</span>
          </h2>
          <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            {loading ? 'Обновляю…' : 'Обновить'}
          </button>
        </div>
        {error && <p className="muted-note">Данные могли устареть: {error}</p>}

        {/* Telegram notifications health check — surfaces the real reason they stop
            (e.g. group → supergroup changes the chat_id, revoked token, bot kicked). */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0 18px' }}>
          <span>
            Telegram-уведомления:{' '}
            {tg == null ? (
              <b style={{ color: 'var(--fog)' }}>не проверено</b>
            ) : tg.ok ? (
              <b style={{ color: '#15803d' }}>работают ✓ (проверь чат)</b>
            ) : (
              <b style={{ color: '#b91c1c' }}>не работают</b>
            )}
          </span>
          <button className="btn btn--ghost btn--sm" onClick={testTelegram} disabled={tgBusy}>
            {tgBusy ? 'Проверяю…' : 'Проверить Telegram'}
          </button>
          {tg && !tg.ok && tg.error && (
            <span className="creator-portal__err" style={{ fontSize: '0.85rem' }}>{tg.error}</span>
          )}
        </div>

        <div className="kpi-grid">
          <Kpi tone="green" icon="user" value={num(creators.online)} label="Креаторов онлайн" hint={`за 5 мин · ${num(creators.active_24h)} за сутки`} />
          <Kpi tone="violet" icon="users" value={num(creators.total)} label="Креаторов всего" hint={`${num(creators.active)} активных · ${num(creators.pending)} ждут доступ`} />
          <Kpi tone="green" icon="briefs" value={num(businesses.online)} label="Бизнесов онлайн" hint={`${num(businesses.total)} всего · +${num(businesses.new_7d)} за неделю`} />
          <Kpi tone="amber" icon="check" value={num(submissions.awaiting_review)} label="Видео ждут проверки" hint={`${num(submissions.awaiting_business)} у бизнеса на приёмке`} />
          <Kpi tone="violet" icon="eye" value={num(submissions.accepted_views)} label="Просмотров принято" hint={`${num(submissions.accepted)} принятых видео`} />
          <Kpi tone="rose" icon="wallet" value={money(payouts.pending_sum)} label="К выплате" hint={`${num(payouts.pending_count)} заявок · выплачено ${money(payouts.paid_sum)}`} />
        </div>
      </section>

      <section className="admin-block">
        <h2 className="admin-block__title">Кто сейчас в кабинете</h2>
        {!onlineNow.length ? (
          <p className="muted-note">Сейчас никого — «онлайн» считается по запросу из кабинета за последние 5 минут.</p>
        ) : (
          <div className="bp-cards">
            {onlineNow.map((u) => (
              <div key={`${u.role}-${u.id}`} className="bp-card">
                <div className="bp-card__head">
                  <b>{u.role === 'creator' ? '🎬' : '🏢'} {u.name}</b>
                  <span className="pf-status pf-status--accepted">онлайн</span>
                </div>
                <p className="creator-portal__muted" style={{ margin: 0 }}>
                  {u.role === 'creator' ? 'креатор' : 'бизнес'} · {relativeTime(u.last_seen_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-block">
        <h2 className="admin-block__title">Воронка и пайплайн</h2>
        <div className="admin-stats">
          <Stat label="Заявок всего" value={num(leads.total)} />
          <Stat label="Заявок сегодня" value={num(leads.today)} />
          <Stat label="Заявок за неделю" value={num(leads.week)} />
          <Stat label="От бизнеса" value={num(leads.client)} />
          <Stat label="От креаторов" value={num(leads.creator)} />
          <Stat label="Лидов по рефералам" value={num(referrals)} />
        </div>
        <div className="admin-stats" style={{ marginTop: 12 }}>
          <Stat label="Брифов активных" value={num(briefs.active)} />
          <Stat label="Брифов на модерации" value={num(briefs.moderation)} />
          <Stat label="Брифов на доработке" value={num(briefs.revision)} />
          <Stat label="Видео на доработке" value={num(submissions.rework)} />
          <Stat label="Видео отклонено" value={num(submissions.rejected)} />
          <Stat label="Видео за неделю" value={num(submissions.new_7d)} />
        </div>
      </section>

      <section className="admin-block">
        <h2 className="admin-block__title">Трафик</h2>
        <div className="admin-stats">
          <Stat label="Визитов сегодня" value={num(traffic.visits_today)} />
          <Stat label="Уникальных сегодня" value={num(traffic.uniques_today)} />
          <Stat label="Визитов за 7 дней" value={num(traffic.visits_7d)} />
          <Stat label="Онбординг пройден" value={num(creators.onboarded)} />
          <Stat label="TikTok подключён" value={num(creators.tiktok_connected)} />
          <Stat label="Креаторов с логином" value={num(creators.with_login)} />
        </div>
      </section>

      <section className="admin-block">
        <h2 className="admin-block__title">Система</h2>
        {/* These are strings, not figures — the numeric display face doesn't fit them. */}
        <div className="admin-stats">
          <Stat variant="text" label="Аптайм" value={formatUptime(system.uptimeSec)} />
          <Stat variant="text" label="Отклик БД" value={`${system.dbLatencyMs} мс${dbSlow ? ' ⚠' : ''}`} />
          <Stat variant="text" label="Пул соединений" value={`${system.pool.total}/${system.pool.max}${poolTight ? ` · ${system.pool.waiting} в очереди ⚠` : ''}`} />
          <Stat variant="text" label="Память (RSS)" value={`${system.rssMb} МБ`} />
          <Stat variant="text" label="Админ-сессий" value={num(system.adminSessions)} />
          <Stat variant="text" label="Окружение" value={`${system.env} · ${system.nodeVersion}`} />
        </div>

        {(dbSlow || poolTight) && (
          <p className="muted-note">
            {dbSlow && 'База отвечает медленнее 200 мс. '}
            {poolTight && 'Запросы стоят в очереди за соединением — пул исчерпан.'}
          </p>
        )}

        <h3 className="admin-block__title" style={{ fontSize: '1rem', marginTop: 20 }}>Интеграции</h3>
        <div className="bp-cards">
          {[
            ['Gemini (AI)', system.features.gemini],
            ['TikTok автосинк', system.features.tiktok],
            ['Spaces (медиа)', system.features.spaces],
            ['reCAPTCHA', system.features.recaptcha],
            ['Telegram', system.features.telegram],
            ['Email (SMTP)', system.features.email],
          ].map(([label, on]) => (
            <div key={label} className="bp-card">
              <div className="bp-card__head">
                <b>{label}</b>
                <span className={`pf-status pf-status--${on ? 'accepted' : 'rejected'}`}>
                  {on ? 'включено' : 'выключено'}
                </span>
              </div>
            </div>
          ))}
          <div className="bp-card">
            <div className="bp-card__head">
              <b>CSP</b>
              <span className={`pf-status pf-status--${system.features.csp === 'enforce' ? 'accepted' : 'rework'}`}>
                {system.features.csp}
              </span>
            </div>
          </div>
        </div>
        {!system.features.recaptcha && (
          <p className="muted-note">
            reCAPTCHA выключена — формы заявок защищены только honeypot’ом и лимитом запросов. Задайте RECAPTCHA_SECRET.
          </p>
        )}
      </section>
    </>
  );
}

