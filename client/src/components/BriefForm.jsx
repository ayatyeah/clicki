import { useState } from 'react';
import { API_BASE } from '../lib/config.js';
import { useLang } from '../i18n.jsx';
import { bt } from '../content/businessI18n.js';
import { PLATFORMS, ANY_PLATFORM, STYLES, VIDEO_FORMATS } from '../lib/briefFields.js';

// Logos may live in Spaces (absolute URL) or Postgres (relative /api/media/:id).
const mediaUrl = (u) => (u && /^https?:\/\//i.test(u) ? u : `${API_BASE}${u}`);

const EMPTY_BRIEF = {
  title: '',
  platform: 'TikTok',
  key_message: '',
  dos: '',
  donts: '',
  req_hashtag: '',
  req_cta_link: '',
  orientation: 'vertical',
  max_duration: 25,
  duration_any: false,
  cta_required: true,
  logo_first5: true,
  brand_spoken: false,
  product_in_frame: true,
  style: 'youth',
  // Creative brief fields (stored in spec).
  product: '',
  usp: '',
  audience_pain: '',
  hook_3sec: '',
  geo: '',
  video_format: '',
  priority_platforms: [],
  reference_links: [{ url: '', note: '' }, { url: '', note: '' }, { url: '', note: '' }],
  logo_url: '',
  submission_rules: '',
};

/** Collapsible section of the brief form — keeps the long form manageable to
 *  fill and readable on a phone (tap a header to expand just that group).
 *  Fields inside are controlled by the parent form state, so collapsing a
 *  section never loses what was typed. */
function BriefSection({ title, hint, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bp-acc ${open ? 'is-open' : ''}`}>
      <button type="button" className="bp-acc__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="bp-acc__title">{title}</span>
        <span className="bp-acc__chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="bp-acc__body">
          {hint && <p className="creator-portal__muted bp-acc__hint">{hint}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The structured brief builder, shared by two surfaces via `variant`:
 *   - 'business' (default): the client creates/edits their own brief; saving sends
 *      it (back) to moderation (POST /api/business/briefs[/:id]).
 *   - 'admin': an operator edits an existing brief and the change goes live for
 *      creators immediately, without a status reset (POST /api/admin/briefs/:id/edit).
 * Everything else — fields, layout, logo upload — is identical.
 */
export function BriefForm({ authFetch, reload, brief = null, draft = null, onDone, variant = 'business' }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const isAdmin = variant === 'admin';
  const uploadUrl = isAdmin ? '/api/admin/upload' : '/api/business/upload';
  const submitUrl = isAdmin ? `/api/admin/briefs/${brief?.id}/edit` : (brief ? `/api/business/briefs/${brief.id}` : '/api/business/briefs');

  const src = brief || draft;
  const initial = src
    ? {
        title: src.title || '',
        platform: src.platform || 'TikTok',
        key_message: src.key_message || '',
        dos: src.dos || '',
        donts: src.donts || '',
        req_hashtag: src.req_hashtag || '',
        req_cta_link: src.req_cta_link || '',
        orientation: src.spec?.orientation || 'vertical',
        max_duration: src.spec?.max_duration || src.duration_max || 25,
        duration_any: src.spec?.duration_any ?? false,
        cta_required: src.spec?.cta_required ?? true,
        logo_first5: src.spec?.logo_first5 ?? true,
        brand_spoken: src.spec?.brand_spoken ?? false,
        product_in_frame: src.spec?.product_in_frame ?? true,
        style: src.spec?.style || 'youth',
        product: src.spec?.product || '',
        usp: src.spec?.usp || '',
        audience_pain: src.spec?.audience_pain || '',
        hook_3sec: src.spec?.hook_3sec || '',
        geo: src.spec?.geo || '',
        video_format: src.spec?.video_format || '',
        priority_platforms: Array.isArray(src.spec?.priority_platforms) ? src.spec.priority_platforms : [],
        // Always 3 slots so the inputs render even when fewer links were saved.
        // Tolerates the old string shape as well as the {url, note} objects.
        reference_links: [0, 1, 2].map((i) => {
          const r = src.spec?.reference_links?.[i];
          return typeof r === 'string' ? { url: r, note: '' } : { url: r?.url || '', note: r?.note || '' };
        }),
        logo_url: src.spec?.logo_url || '',
        submission_rules: src.spec?.submission_rules || '',
      }
    : EMPTY_BRIEF;
  const [f, setF] = useState(initial);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setRefField = (i, field, v) => setF((s) => ({
    ...s,
    reference_links: s.reference_links.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)),
  }));
  const togglePlatform = (p) => setF((s) => ({
    ...s,
    priority_platforms: s.priority_platforms.includes(p)
      ? s.priority_platforms.filter((x) => x !== p)
      : [...s.priority_platforms, p],
  }));

  const uploadLogo = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError(t('Нужно изображение (JPG или PNG).'));
    setLogoBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch(uploadUrl, { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok || d.ok === false) throw new Error(d.errors?.[0] || t('Не удалось загрузить'));
      set('logo_url', d.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLogoBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!f.title.trim()) return setError(t('Укажите название брифа'));
    setBusy(true);
    try {
      const payload = {
        title: f.title,
        platform: f.platform,
        key_message: f.key_message,
        dos: f.dos,
        donts: f.donts,
        req_hashtag: f.req_hashtag,
        req_cta_link: f.req_cta_link,
        duration_max: Number(f.max_duration) || 25,
        tone: STYLES.find((s) => s[0] === f.style)?.[1] || f.style,
        spec: {
          orientation: f.orientation,
          max_duration: Number(f.max_duration) || 25,
          cta_required: f.cta_required,
          logo_first5: f.logo_first5,
          brand_spoken: f.brand_spoken,
          product_in_frame: f.product_in_frame,
          style: f.style,
          product: f.product.trim(),
          usp: f.usp.trim(),
          audience_pain: f.audience_pain.trim(),
          hook_3sec: f.hook_3sec.trim(),
          geo: f.geo.trim(),
          video_format: f.video_format,
          // Priority platforms only apply when the brief accepts any platform.
          priority_platforms: f.platform === ANY_PLATFORM ? f.priority_platforms : [],
          duration_any: f.duration_any,
          reference_links: f.reference_links
            .map((r) => ({ url: (r.url || '').trim(), note: (r.note || '').trim() }))
            .filter((r) => r.url),
          logo_url: f.logo_url,
          submission_rules: f.submission_rules.trim(),
        },
      };
      const res = await authFetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || t('Ошибка'));
      // Admin edits an existing brief in place — keep the values shown; the
      // business create flow resets the form for the next brief.
      if (!isAdmin) setF(EMPTY_BRIEF);
      setMsg(isAdmin ? t('Сохранено — изменения сразу у креаторов ✓') : (brief ? `${t('Отправлено на модерацию')} ✓` : `${t('Бриф создан')} ✓`));
      reload?.();
      onDone?.();
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitText = busy
    ? t('Сохраняю…')
    : isAdmin ? t('Сохранить — обновить у креаторов') : brief ? t('Отправить на модерацию') : t('Создать бриф');

  return (
    <form className="creator-portal__card bp-form" onSubmit={submit}>
      <div className="creator-portal__q">
        <div className="creator-portal__q-title">{t('Название брифа')} *</div>
        <input placeholder={t('Например: Запуск нового аромата')} value={f.title} onChange={(e) => set('title', e.target.value)} />
      </div>

      <div className="creator-portal__q">
        <div className="creator-portal__q-title">{t('Платформа')}</div>
        <select value={f.platform} onChange={(e) => set('platform', e.target.value)}>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          <option value={ANY_PLATFORM}>{t('Любая платформа')}</option>
        </select>
        {f.platform === ANY_PLATFORM && (
          <p className="creator-portal__muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
            {t('Креатор снимет на удобной ему площадке и выберет её при сдаче.')}
          </p>
        )}
      </div>

      {/* Priority platforms — only meaningful when the brief accepts any platform. */}
      {f.platform === ANY_PLATFORM && (
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Приоритетные платформы (по желанию)')}</div>
          <p className="creator-portal__muted" style={{ margin: '0 0 6px', fontSize: '0.82rem' }}>
            {t('Если какие-то площадки важнее — отметь их, креатор увидит приоритет.')}
          </p>
          <div className="bp-tags">
            {PLATFORMS.map((p) => (
              <label key={p} className={`bp-tag ${f.priority_platforms.includes(p) ? 'is-on' : ''}`}>
                <input type="checkbox" checked={f.priority_platforms.includes(p)} onChange={() => togglePlatform(p)} />
                {t(p)}
              </label>
            ))}
          </div>
        </div>
      )}

      <BriefSection title={t('Оффер и посыл')} defaultOpen>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Конкретный продукт / услуга / акция')}</div>
          <input placeholder={t('Не «весь бренд», а точный оффер')} value={f.product} onChange={(e) => set('product', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Главная фишка продукта (почему выберут вас)?')}</div>
          <input placeholder={t('Главное преимущество / УТП')} value={f.usp} onChange={(e) => set('usp', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Кто ваш клиент и какую проблему решает оффер?')}</div>
          <textarea rows={2} placeholder={t('Целевая аудитория и её боль')} value={f.audience_pain} onChange={(e) => set('audience_pain', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Что зритель должен понять за первые 3 секунды (одно предложение)')}</div>
          <input placeholder={t('Одна мысль, которая цепляет с первых секунд')} value={f.hook_3sec} onChange={(e) => set('hook_3sec', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('География (города / страны)')}</div>
          <input placeholder={t('Например: Алматы, Астана')} value={f.geo} onChange={(e) => set('geo', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Ключевое сообщение')}</div>
          <input placeholder={t('Что должен донести ролик')} value={f.key_message} onChange={(e) => set('key_message', e.target.value)} />
        </div>
      </BriefSection>

      <BriefSection title={t('Техзадание: съёмка и монтаж')} defaultOpen={!!brief}>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Ориентация')}</div>
          <label className="creator-portal__opt"><input type="radio" name="orientation" checked={f.orientation === 'vertical'} onChange={() => set('orientation', 'vertical')} /> {t('Вертикальное')}</label>
          <label className="creator-portal__opt"><input type="radio" name="orientation" checked={f.orientation === 'horizontal'} onChange={() => set('orientation', 'horizontal')} /> {t('Горизонтальное')}</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Длительность')}</div>
          <label className="pf-check"><input type="checkbox" checked={f.duration_any} onChange={(e) => set('duration_any', e.target.checked)} /> {t('Произвольная — без конкретных таймингов')}</label>
          {!f.duration_any && (
            <input type="number" min="5" max="180" style={{ marginTop: 8 }} placeholder={t('Максимум, сек')} value={f.max_duration} onChange={(e) => set('max_duration', e.target.value)} />
          )}
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Желаемый формат ролика')}</div>
          <select value={f.video_format} onChange={(e) => set('video_format', e.target.value)}>
            <option value="">{t('Не важно')}</option>
            {VIDEO_FORMATS.map((v) => <option key={v} value={v}>{t(v)}</option>)}
          </select>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">CTA</div>
          <label className="pf-check"><input type="checkbox" checked={f.cta_required} onChange={(e) => set('cta_required', e.target.checked)} /> {t('Обязательно')}</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Ссылка для CTA (по желанию)')}</div>
          <input placeholder={t('https://ваш-сайт.kz/акция')} value={f.req_cta_link} onChange={(e) => set('req_cta_link', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Логотип в первые 5 секунд')}</div>
          <label className="pf-check"><input type="checkbox" checked={f.logo_first5} onChange={(e) => set('logo_first5', e.target.checked)} /> {t('Обязательно')}</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Название бренда')}</div>
          <label className="pf-check"><input type="checkbox" checked={f.brand_spoken} onChange={(e) => set('brand_spoken', e.target.checked)} /> {t('Обязательно произнести')}</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Продукт в кадре')}</div>
          <label className="pf-check"><input type="checkbox" checked={f.product_in_frame} onChange={(e) => set('product_in_frame', e.target.checked)} /> {t('Да')}</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Логотип бренда (картинка)')}</div>
          {f.logo_url ? (
            <div className="bp-logo">
              <img className="bp-logo__img" src={mediaUrl(f.logo_url)} alt="" />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('logo_url', '')}>{t('Удалить')}</button>
            </div>
          ) : (
            <label className="btn btn--ghost btn--sm">
              {logoBusy ? t('Загрузка…') : t('Загрузить логотип')}
              <input type="file" accept="image/*" hidden disabled={logoBusy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; uploadLogo(file); }} />
            </label>
          )}
        </div>
      </BriefSection>

      <BriefSection title={t('Стиль ролика')} defaultOpen={!!brief}>
        <div className="creator-portal__q">
          {STYLES.map(([val, label]) => (
            <label key={val} className="creator-portal__opt">
              <input type="radio" name="style" checked={f.style === val} onChange={() => set('style', val)} /> {t(label)}
            </label>
          ))}
        </div>
      </BriefSection>

      <BriefSection title={t('Сценарий, референсы и сдача')} defaultOpen={!!brief}>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Сценарий / структура видео (по желанию)')}</div>
          <textarea rows={3} placeholder={t('Чёткий script: что в начале, в середине и в конце — по секундам, если нужно')} value={f.dos} onChange={(e) => set('dos', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Чего не делать (по желанию)')}</div>
          <textarea rows={2} placeholder={t('Например: не упоминать конкурентов')} value={f.donts} onChange={(e) => set('donts', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Хэштег (по желанию)')}</div>
          <input placeholder={t('#бренд')} value={f.req_hashtag} onChange={(e) => set('req_hashtag', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Референсы — 2–3 ролика (по желанию)')}</div>
          <p className="creator-portal__muted" style={{ margin: '0 0 6px', fontSize: '0.82rem' }}>
            {t('Ролик, который нравится — ссылка и, по желанию, почему его взяли.')}
          </p>
          {f.reference_links.map((r, i) => (
            <div className="bp-ref" key={i}>
              <input
                type="url"
                inputMode="url"
                placeholder={`${t('Ссылка на референс')} ${i + 1}`}
                value={r.url}
                onChange={(e) => setRefField(i, 'url', e.target.value)}
              />
              <input
                placeholder={t('Почему взяли этот референс (по желанию)')}
                value={r.note}
                onChange={(e) => setRefField(i, 'note', e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Правила сдачи материалов (по желанию)')}</div>
          <textarea
            rows={2}
            placeholder={t('Например: сдать до 20 числа, прислать ссылку на опубликованное видео + скриншот статистики')}
            value={f.submission_rules}
            onChange={(e) => set('submission_rules', e.target.value)}
          />
        </div>
      </BriefSection>

      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>{submitText}</button>
      {msg && <p className="creator-portal__muted" style={{ textAlign: 'center', color: '#15803d' }}>{msg}</p>}
    </form>
  );
}

export default BriefForm;
