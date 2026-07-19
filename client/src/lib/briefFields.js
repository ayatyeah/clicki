// Business-supplied creative fields that live in brief.spec (JSONB) — no schema
// column per field. One definition shared by the business brief builder and by
// both readers (creator brief card, admin brief moderation) so a new field shows
// up everywhere at once.

/** Video-format options for «Желаемый формат ролика». */
export const VIDEO_FORMATS = ['Распаковка', 'POV', 'Говорящая голова', 'Обзор приложения', 'Тренды'];

/** How many reference-video link slots the business gets. */
export const REFERENCE_SLOTS = 3;

/**
 * Simple [label, value] text rows for the extra spec fields, in display order.
 * reference_links (rendered as links) and logo_url (rendered as an image) are
 * handled separately by each surface — they aren't plain text.
 */
export function briefOfferRows(b) {
  const s = (b && b.spec) || {};
  const rows = [];
  if (s.product) rows.push(['Продукт / услуга / акция', s.product]);
  if (s.usp) rows.push(['Главное преимущество (УТП)', s.usp]);
  if (s.audience_pain) rows.push(['Целевая аудитория и её боль', s.audience_pain]);
  if (s.hook_3sec) rows.push(['Первые 3 секунды', s.hook_3sec]);
  if (s.geo) rows.push(['География', s.geo]);
  if (s.video_format) rows.push(['Формат ролика', s.video_format]);
  if (Array.isArray(s.priority_platforms) && s.priority_platforms.length) {
    rows.push(['Приоритетные платформы', s.priority_platforms.join(', ')]);
  }
  if (s.submission_rules) rows.push(['Правила сдачи материалов', s.submission_rules]);
  return rows;
}

/** Non-empty reference video links from the spec. */
export function briefRefLinks(b) {
  const s = (b && b.spec) || {};
  return Array.isArray(s.reference_links) ? s.reference_links.filter((x) => x && String(x).trim()) : [];
}
