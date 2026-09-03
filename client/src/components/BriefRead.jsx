import { safeHref } from '../lib/safeHref.js';
import { API_BASE } from '../lib/config.js';
import { briefOfferRows, briefRefLinks } from '../lib/briefFields.js';

const mediaUrl = (u) => (u && /^https?:\/\//i.test(u) ? u : `${API_BASE}${u}`);

/**
 * The whole brief, read-only — everything filled in, including the `spec`
 * from the brief builder. Originally admin-only (a card only ever showed the
 * title/platform/hashtag, so an operator published a brief without being able
 * to read what it asked for); now also used by the business cabinet so a
 * business can reopen its own brief instead of only remembering what it typed.
 *
 * `t` lets a caller translate the fixed labels — admin has no i18n, so it's
 * an identity function by default; the business cabinet passes its `bt`-based
 * translator. `briefOfferRows(b)`'s own labels are deliberately left
 * untranslated here, matching CreatorPortal's BriefCard (see lib/briefFields.js)
 * — no dictionary entries exist for them anywhere in the app yet.
 * `showMeta` renders the "who sent this / when" line — a business reading its
 * own brief already knows that, so the business cabinet passes `showMeta={false}`.
 *
 * Empty fields are dropped rather than rendered as "—": admin-created briefs
 * legitimately have no goal/audience, and a wall of dashes hides the real
 * content. `tone` already holds the human-readable style label (the business
 * portal writes it there alongside the raw spec.style key), so no map is needed.
 */
export function BriefRead({ b, t = (s) => s, lang = 'ru', showMeta = true }) {
  const spec = b.spec || {};
  const who = b.business_company || b.business_name;

  const facts = [
    [t('Платформа'), b.platform],
    [t('Ориентация'), spec.orientation ? (spec.orientation === 'horizontal' ? t('Горизонтальное') : t('Вертикальное')) : null],
    [t('Длительность'), spec.duration_any
      ? t('Произвольная — без конкретных таймингов')
      : (b.duration_max ? `${b.duration_min || 0}–${b.duration_max} ${lang === 'en' ? 's' : 'с'}` : null)],
    [t('Стиль'), b.tone || spec.style],
    [t('Слотов'), b.slots || null],
    [t('Хэштег'), b.req_hashtag],
  ].filter(([, v]) => v != null && v !== '');

  const texts = [
    [t('Цель'), b.goal],
    [t('Аудитория'), b.audience],
    // Business creative brief (product, УТП, боль, 3-сек, гео, формат, платформы)
    ...briefOfferRows(b),
    [t('Ключевое сообщение'), b.key_message],
    [t('Что нужно показать'), b.dos],
    [t('Чего не делать'), b.donts],
    [t('Референсы'), b.refs],
  ].filter(([, v]) => v && String(v).trim());
  const refLinks = briefRefLinks(b);

  const flags = [
    [b.req_mention, t('Упоминание бренда в первые 3 сек')],
    [spec.cta_required, t('CTA обязателен')],
    [spec.logo_first5, t('Логотип в первые 5 секунд')],
    [spec.brand_spoken, t('Бренд произносится вслух')],
    [spec.product_in_frame, t('Продукт в кадре')],
  ].filter(([on]) => on).map(([, label]) => label);

  // A brand-supplied URL rendered as a link: safeHref returns undefined for
  // anything that isn't http(s), and we then show it as inert text.
  const cta = safeHref(b.req_cta_link);

  return (
    <div className="brief-read">
      {showMeta && (
        <div className="brief-read__block">
          <span className="brief-read__k">Прислал</span>
          <span className="brief-read__v">
            {who ? `${who}${b.business_company && b.business_name ? ` · ${b.business_name}` : ''} (#${b.business_id})` : 'Создан в админке'}
            {b.created_at ? ` · ${new Date(b.created_at).toLocaleString('ru-RU')}` : ''}
          </span>
        </div>
      )}

      {!!facts.length && (
        <div className="brief-read__grid">
          {facts.map(([k, v]) => (
            <div className="brief-read__block" key={k}>
              <span className="brief-read__k">{k}</span>
              <span className="brief-read__v">{v}</span>
            </div>
          ))}
        </div>
      )}

      {b.req_cta_link && (
        <div className="brief-read__block">
          <span className="brief-read__k">{t('CTA-ссылка')}</span>
          <span className="brief-read__v">
            {cta ? <a href={cta} target="_blank" rel="noopener noreferrer">{b.req_cta_link}</a> : b.req_cta_link}
          </span>
        </div>
      )}

      {texts.map(([k, v]) => (
        <div className="brief-read__block" key={k}>
          <span className="brief-read__k">{k}</span>
          <span className="brief-read__v">{v}</span>
        </div>
      ))}

      {refLinks.length > 0 && (
        <div className="brief-read__block">
          <span className="brief-read__k">{t('Референсы')}</span>
          <div className="brief-read__v">
            {refLinks.map((r, i) => {
              const href = safeHref(r.url);
              return (
                <div key={i} className="brief-ref">
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer">{t('Референс')} {i + 1}</a> : r.url}
                  {r.note && <span className="brief-ref__note"> — {r.note}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {spec.logo_url && (
        <div className="brief-read__block">
          <span className="brief-read__k">{t('Логотип')}</span>
          <img className="brief-read__logo" src={mediaUrl(spec.logo_url)} alt={t('Логотип бренда')} />
        </div>
      )}

      {!!flags.length && (
        <div className="brief-read__block">
          <span className="brief-read__k">{t('Требования')}</span>
          <div className="brief-read__flags">
            {flags.map((f) => <span className="brief-read__flag" key={f}>{f}</span>)}
          </div>
        </div>
      )}

      {!facts.length && !texts.length && !flags.length && !b.req_cta_link && !refLinks.length && !spec.logo_url && (
        <p className="brief-read__empty" style={{ margin: 0 }}>{t('В брифе заполнено только название.')}</p>
      )}
    </div>
  );
}
