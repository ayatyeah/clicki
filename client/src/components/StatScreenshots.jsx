import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/config.js';
import Lightbox from './Lightbox.jsx';
import { useToast } from './Toast.jsx';

/**
 * Daily stats screenshots for one submitted video.
 *
 * After a creator submits a video they must upload a fresh TikTok/Instagram
 * stats screenshot every 24h (see the in-app guide). Screenshots accumulate and
 * are never deleted. Used two ways:
 *   - creator (canUpload): guide + drag-and-drop upload with progress + series
 *   - operator (read-only): the series, to verify the daily reports
 *
 * Thumbnails open in an in-page Lightbox (zoom + prev/next) instead of a raw
 * new tab. `basePath` selects the API surface so both roles reuse this UI.
 */

// Screenshots may live in Spaces (absolute URL) or Postgres (relative /api/media/:id).
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
const isInstagram = (platform) => /instagram|reels/i.test(platform || '');
const guideFor = (platform) => (isInstagram(platform) ? GUIDE.Instagram : GUIDE.TikTok);

// Must match SCREENSHOT_COOLDOWN_MS on the server. The server is the source of
// truth (it rejects an early upload); this only drives the UI hint.
const COOLDOWN_MS = 10 * 60 * 60 * 1000;
const cooldownLeft = (lastAt) => {
  if (!lastAt) return 0;
  const left = COOLDOWN_MS - (Date.now() - new Date(lastAt).getTime());
  return left > 0 ? left : 0;
};
const fmtLeft = (ms) => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.ceil((ms % 3_600_000) / 60_000);
  return `${h ? `${h} ч ` : ''}${m} мин`;
};

export default function StatScreenshots({ submissionId, platform, basePath, authFetch, canUpload = false, today = false, count = 0, lastAt = null }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shots, setShots] = useState(null);
  const [progress, setProgress] = useState(null); // null idle | 0-100 uploading
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${basePath}/${submissionId}/screenshots`);
      const d = await res.json();
      if (res.ok && d.ok !== false) setShots(d.screenshots || []);
    } catch {
      /* leave as null; reopening retries */
    }
  }, [authFetch, basePath, submissionId]);

  useEffect(() => {
    if (open && shots === null) load();
  }, [open, shots, load]);

  // XHR (not fetch) so the creator sees a real progress bar for the upload.
  const upload = useCallback(
    (file) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) return setError('Нужен скриншот-изображение (JPG или PNG).');
      if (file.size > 4 * 1024 * 1024) return setError('Слишком большой файл — сделайте обычный скриншот (до 4 МБ).');
      setError('');
      setProgress(0);
      const fd = new FormData();
      fd.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}${basePath}/${submissionId}/screenshots`);
      const token = sessionStorage.getItem('clicki_creator_token') || sessionStorage.getItem('clicki_admin_token') || '';
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        setProgress(null);
        let d = {};
        try { d = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300 && d.ok !== false) {
          setShots(d.screenshots || []);
          setOpen(true);
          toast.success('Скриншот загружен');
        } else {
          const msg = d.errors?.[0] || 'Не удалось загрузить';
          setError(msg);
          toast.error(msg);
        }
      };
      xhr.onerror = () => { setProgress(null); setError('Ошибка сети при загрузке'); toast.error('Ошибка сети при загрузке'); };
      xhr.send(fd);
    },
    [basePath, submissionId, toast]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    upload(e.dataTransfer.files?.[0]);
  };

  const total = shots ? shots.length : count;
  const guide = guideFor(platform);
  const lightboxItems = (shots || []).map((s) => ({ src: mediaSrc(s.url), caption: s.at }));
  const waitMs = cooldownLeft(lastAt);
  const onCooldown = canUpload && waitMs > 0 && progress === null;

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
                Раз в сутки прикладывай свежий скриншот статистики этого видео из {isInstagram(platform) ? 'Instagram' : 'TikTok'}. Скрины сохраняются и не удаляются.
              </p>

              {onCooldown ? (
                <div className="stat-shots__cooldown">
                  ⏳ Скриншот за сегодня принят. Следующий можно загрузить через <b>{fmtLeft(waitMs)}</b> — так график роста по дням остаётся ровным.
                </div>
              ) : (
                <div
                  className={`stat-shots__drop ${dragOver ? 'is-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => progress === null && fileRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
                >
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f); }} />
                  {progress === null ? (
                    <>
                      <span className="stat-shots__drop-icon" aria-hidden="true">⬆</span>
                      <span>Перетащи скриншот сюда или <u>выбери файл</u></span>
                    </>
                  ) : (
                    <div className="stat-shots__progress">
                      <div className="stat-shots__progress-bar" style={{ width: `${progress}%` }} />
                      <span className="stat-shots__progress-label">Загрузка… {progress}%</span>
                    </div>
                  )}
                </div>
              )}

              <div className="stat-shots__actions">
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
              {shots.map((s, i) => (
                <button type="button" key={s.id} className="stat-shots__thumb" onClick={() => setLightboxIndex(i)} title="Открыть">
                  <img src={mediaSrc(s.url)} alt={`Скриншот ${s.at}`} loading="lazy" />
                  <span className="stat-shots__date">{s.at}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Lightbox items={lightboxItems} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
    </div>
  );
}
