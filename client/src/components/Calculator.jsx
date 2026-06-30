import { useMemo, useState } from 'react';

/**
 * Sales calculator "N creators → views" (ТЗ §11). A power forecast, NOT a
 * guarantee — always shows a range (min/typical/max) with the mandatory
 * disclaimer (§11.5 / §2). Rates are the single source of truth from §2.
 *
 * Median views/video are pre-MVP placeholders for the sales tool; once the
 * platform has 90 days of real data (§11.2) these should come from the `rates`
 * table via the API, not be hardcoded.
 */
const PLATFORMS = [
  { key: 'tiktok', label: 'TikTok', rate: 0.8, median: 9000, icon: '/social/tiktok.svg' },
  { key: 'instagram', label: 'Instagram Reels', rate: 0.85, median: 7000, icon: '/social/instagram.svg' },
  { key: 'youtube', label: 'YouTube Shorts', rate: 0.7, median: 6000, icon: '/social/youtube.svg' },
  { key: 'threads', label: 'Threads', rate: 1.1, median: 3500, icon: '/social/threads.svg' },
  { key: 'x', label: 'X (Twitter)', rate: 1.2, median: 3000, icon: '/social/x.svg' },
];

const MIN_FACTOR = 0.6;
const MAX_FACTOR = 1.4;

const COPY = {
  ru: {
    eyebrow: 'Калькулятор',
    title: 'Сколько просмотров за ваш бюджет',
    sub: 'Подвигайте ползунки и выберите площадки — оценка пересчитывается в реальном времени.',
    creators: 'Креаторов',
    videos: 'Видео на креатора',
    platforms: 'Площадки',
    forecastViews: 'Прогноз просмотров',
    forecastCost: 'Оценочная стоимость',
    typical: 'типично',
    range: 'диапазон',
    perView: '₸ за просмотр (блендовая ставка)',
    needPlatform: 'Выберите хотя бы одну площадку',
    cta: (n) => `Узнать точную стоимость для ${n} ${plural(n, ['креатора', 'креаторов', 'креаторов'])}`,
    disclaimer:
      'Оценка на основе медианных показателей креаторов CLICKI за последние 90 дней. Не является гарантией результата — фактическая оплата происходит по подтверждённым просмотрам (см. условия). Датасет пересчитывается ежемесячно.',
    views: 'просмотров',
  },
  en: {
    eyebrow: 'Calculator',
    title: 'How many views your budget buys',
    sub: 'Drag the sliders and pick platforms — the estimate updates in real time.',
    creators: 'Creators',
    videos: 'Videos per creator',
    platforms: 'Platforms',
    forecastViews: 'Forecast views',
    forecastCost: 'Estimated cost',
    typical: 'typical',
    range: 'range',
    perView: '₸ per view (blended rate)',
    needPlatform: 'Select at least one platform',
    cta: (n) => `Get an exact quote for ${n} creator${n === 1 ? '' : 's'}`,
    disclaimer:
      'Estimate based on CLICKI creators’ median performance over the last 90 days. Not a guarantee of results — actual billing is for confirmed views only (see terms). The dataset is recalculated monthly.',
    views: 'views',
  },
};

function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function fmt(n, lang) {
  return Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU');
}

// Compact ₸ for the big numbers (1.2M, 340K).
function compact(n, lang) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return fmt(n, lang);
}

export default function Calculator({ lang = 'ru' }) {
  const t = COPY[lang] ?? COPY.ru;
  const [creators, setCreators] = useState(10);
  const [videos, setVideos] = useState(2);
  const [selected, setSelected] = useState(['tiktok', 'instagram']);

  const toggle = (key) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const result = useMemo(() => {
    const picked = PLATFORMS.filter((p) => selected.includes(p.key));
    if (!picked.length) return null;
    // Even blend across the chosen platforms (§11.3 weighted-average rate).
    const blendedRate = picked.reduce((s, p) => s + p.rate, 0) / picked.length;
    const blendedMedian = picked.reduce((s, p) => s + p.median, 0) / picked.length;
    const typicalViews = creators * videos * blendedMedian;
    return {
      blendedRate,
      viewsMin: typicalViews * MIN_FACTOR,
      viewsTypical: typicalViews,
      viewsMax: typicalViews * MAX_FACTOR,
      costMin: typicalViews * MIN_FACTOR * blendedRate,
      costTypical: typicalViews * blendedRate,
      costMax: typicalViews * MAX_FACTOR * blendedRate,
    };
  }, [creators, videos, selected]);

  return (
    <div className="calc">
      <div className="calc__controls">
        <div className="calc__field">
          <div className="calc__field-head">
            <label htmlFor="calc-creators">{t.creators}</label>
            <span className="calc__field-value">{creators}</span>
          </div>
          <input
            id="calc-creators"
            type="range"
            min="1"
            max="50"
            value={creators}
            onChange={(e) => setCreators(+e.target.value)}
            className="calc__range"
          />
        </div>

        <div className="calc__field">
          <div className="calc__field-head">
            <label htmlFor="calc-videos">{t.videos}</label>
            <span className="calc__field-value">{videos}</span>
          </div>
          <input
            id="calc-videos"
            type="range"
            min="1"
            max="6"
            value={videos}
            onChange={(e) => setVideos(+e.target.value)}
            className="calc__range"
          />
        </div>

        <div className="calc__field">
          <div className="calc__field-head">
            <span>{t.platforms}</span>
          </div>
          <div className="calc__platforms">
            {PLATFORMS.map((p) => (
              <button
                type="button"
                key={p.key}
                className={`calc__chip ${selected.includes(p.key) ? 'is-on' : ''}`}
                onClick={() => toggle(p.key)}
                aria-pressed={selected.includes(p.key)}
              >
                <img src={p.icon} alt="" className="calc__chip-icon" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="calc__result">
        {!result ? (
          <p className="calc__need">{t.needPlatform}</p>
        ) : (
          <>
            <div className="calc__metric">
              <span className="calc__metric-label">{t.forecastViews}</span>
              <span className="calc__metric-value">{compact(result.viewsTypical, lang)}</span>
              <span className="calc__metric-range">
                {t.range}: {compact(result.viewsMin, lang)} – {compact(result.viewsMax, lang)} {t.views}
              </span>
            </div>

            <div className="calc__divider" />

            <div className="calc__metric">
              <span className="calc__metric-label">{t.forecastCost}</span>
              <span className="calc__metric-value calc__metric-value--accent">
                ≈ {compact(result.costTypical, lang)} ₸
              </span>
              <span className="calc__metric-range">
                {t.range}: {compact(result.costMin, lang)} – {compact(result.costMax, lang)} ₸
              </span>
            </div>

            <div className="calc__rate">
              {result.blendedRate.toFixed(2)} {t.perView}
            </div>

            <a href="#consult" className="btn btn--primary btn--block calc__cta">
              {t.cta(creators)}
            </a>
            <p className="calc__disclaimer">{t.disclaimer}</p>
          </>
        )}
      </div>
    </div>
  );
}
