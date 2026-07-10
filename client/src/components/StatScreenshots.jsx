import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/config.js';

/**
 * Daily stats screenshots for one submitted video.
 *
 * After a creator submits a video they must upload a fresh TikTok/Instagram
 * stats screenshot every 24h (see the in-app guide). Screenshots accumulate and
 * are never deleted. This component is used two ways:
 *   - creator (canUpload): guide + upload button + the running series
 *   - operator (read-only): just the series, to verify the daily reports
 *
 * `basePath` selects the API surface — /api/creator/submissions for the creator,
 * /api/admin/submissions for the operator — so both reuse the exact same UI.
 */

// Screenshots may be stored in Spaces (absolute URL) or in Postgres (a relative
// /api/media/:id path that needs the API origin prefixed for <img>).
const mediaSrc = (url) => (/^https?:\/\//i.test(url) ? url : `${API_BASE}${url}`);

const GUIDE = {
  TikTok: {
    steps: [
      { img: '/guide/tiktok-1-dots.jpg', text: 'Откройте своё видео по брифу и нажмите три точки (•••) справа.' },
      { img: '/guide/tiktok-2-stats.jpg', text: 'В меню выберите раздел «Статистика».' },
      { img: '/guide/tiktok-3-example.jpg', text: 'Сделайте скриншот страницы «Обзор» — как на примере — и загрузите его сюда.' },
    ],
  },
  Instagram: {
    steps: [
      { img: '/guide/instagram-1-view-stats.jpg', text: 'Под своим видео нажмите «Смотреть статистику».' },
      { img: '/guide/instagram-2-example.jpg', text: 'Сделайте скриншот «Сводки» — как на примере — и загрузите его сюда.' },
    ],
  },
};
// Instagram Reels / любые IG-платформы → инстаграм-гайд; всё остальное → тикток.
const guideFor = (platform) => (/instagram|reels/i.test(platform || '') ? GUIDE.Instagram : GUIDE.TikTok);

export default function StatScreenshots({ submissionId, platform, basePath, authFetch, canUpload = false, today = false, count = 0, lastAt = null }) {
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shots, setShots] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${basePath}/${submissionId}/screenshots`);
      const d = await res.json();
      if (res.ok && d.ok !== false) setShots(d.screenshots || []);
    } catch {
      /* leave as null; the toggle can be retried */
    }
  }, [authFetch, basePath, submissionId]);

  useEffect(() => {
    if (open && shots === null) load();
  }, [open, shots, load]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after an error
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Нужен скриншот-изображение (JPG или PNG).');
    if (file.size > 4 * 1024 * 1024) return setError('Слишком большой файл — сделайте обычный скриншот (до 4 МБ).');
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch(`${basePath}/${submissionId}/screenshots`, { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok || d.ok === false) throw new Error(d.errors?.[0] || 'Не удалось загрузить');
      setShots(d.screenshots || []);
      setOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const total = shots ? shots.length : count;
  const guide = guideFor(platform);

  return (
    <div className="stat-shots">
      <div className="stat-shots__head">
        <button type="button" className="stat-shots__toggle" onClick={() => setOpen((v) => !v)}>
          📊 Статистика по дням{total ? ` (${total})` : ''}
        </button>
        {canUpload &&
          (today ? (
            <span className="pf-status pf-status--accepted">сегодня сдано ✓</span>
          ) : (
            <span className="pf-status pf-status--rework">нужен скрин за сегодня</span>
          ))}
        {!canUpload && lastAt && (
          <span className="stat-shots__muted">последний: {new Date(lastAt).toLocaleDateString('ru-RU')}</span>
        )}
      </div>

      {open && (
        <div className="stat-shots__body">
          {canUpload && (
            <div className="stat-shots__upload">
              <p className="stat-shots__hint">
                Раз в сутки прикладывай свежий скриншот статистики этого видео из {/instagram|reels/i.test(platform || '') ? 'Instagram' : 'TikTok'}. Скрины сохраняются и не удаляются.
              </p>
              <div className="stat-shots__actions">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
                <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? 'Загружаю…' : 'Загрузить скриншот'}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setGuideOpen((v) => !v)}>
                  {guideOpen ? 'Скрыть, как снять' : 'Как снять скриншот?'}
                </button>
              </div>
              {error && <p className="creator-portal__err">{error}</p>}

              {guideOpen && (
                <ol className="stat-shots__guide">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="stat-shots__guide-step">
                      <span className="stat-shots__guide-text">{step.text}</span>
                      <img className="stat-shots__guide-img" src={step.img} alt={`Шаг ${i + 1}`} loading="lazy" />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {shots === null ? (
            <p className="stat-shots__muted">Загрузка…</p>
          ) : shots.length === 0 ? (
            <p className="stat-shots__muted">Пока нет ни одного скриншота.</p>
          ) : (
            <div className="stat-shots__grid">
              {shots.map((s) => (
                <a key={s.id} className="stat-shots__thumb" href={mediaSrc(s.url)} target="_blank" rel="noreferrer">
                  <img src={mediaSrc(s.url)} alt={`Скриншот ${s.at}`} loading="lazy" />
                  <span className="stat-shots__date">{s.at}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
