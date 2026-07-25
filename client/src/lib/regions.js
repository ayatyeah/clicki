// Maps a free-text country (as a creator typed it — RU or EN, various spellings)
// to a broad region, so the admin roster can filter by Европа / Азия / Америка.
// The country field is free text, so this is a best-effort dictionary: unknown or
// empty values return null and match only "all". Russia is flagged separately so
// "Европа без России" can exclude it.

const EUROPE = [
  'россия', 'russia', 'рф', 'russian federation',
  'украина', 'ukraine', 'беларусь', 'белоруссия', 'belarus',
  'германия', 'germany', 'deutschland', 'польша', 'poland',
  'франция', 'france', 'испания', 'spain', 'италия', 'italy',
  'великобритания', 'англия', 'uk', 'united kingdom', 'england', 'britain',
  'нидерланды', 'голландия', 'netherlands', 'бельгия', 'belgium',
  'швеция', 'sweden', 'норвегия', 'norway', 'финляндия', 'finland',
  'дания', 'denmark', 'австрия', 'austria', 'швейцария', 'switzerland',
  'чехия', 'czech', 'czechia', 'словакия', 'slovakia',
  'венгрия', 'hungary', 'румыния', 'romania', 'болгария', 'bulgaria',
  'греция', 'greece', 'португалия', 'portugal', 'ирландия', 'ireland',
  'литва', 'lithuania', 'латвия', 'latvia', 'эстония', 'estonia',
  'молдова', 'молдавия', 'moldova', 'сербия', 'serbia',
  'хорватия', 'croatia', 'словения', 'slovenia', 'исландия', 'iceland',
];

const ASIA = [
  'казахстан', 'kazakhstan', 'кз', 'kz',
  'кыргызстан', 'киргизия', 'kyrgyzstan', 'узбекистан', 'uzbekistan',
  'таджикистан', 'tajikistan', 'туркменистан', 'turkmenistan',
  'азербайджан', 'azerbaijan', 'армения', 'armenia', 'грузия', 'georgia',
  'турция', 'turkey', 'türkiye', 'китай', 'china',
  'индия', 'india', 'япония', 'japan',
  'корея', 'южная корея', 'korea', 'south korea',
  'оаэ', 'эмираты', 'uae', 'emirates', 'саудовская аравия', 'saudi arabia', 'saudi',
  'израиль', 'israel', 'иран', 'iran', 'пакистан', 'pakistan',
  'индонезия', 'indonesia', 'малайзия', 'malaysia', 'сингапур', 'singapore',
  'таиланд', 'тайланд', 'thailand', 'вьетнам', 'vietnam',
  'монголия', 'mongolia', 'афганистан', 'afghanistan',
];

const AMERICA = [
  'сша', 'америка', 'usa', 'us', 'u.s.', 'united states', 'штаты', 'соединённые штаты',
  'канада', 'canada', 'мексика', 'mexico',
  'бразилия', 'brazil', 'аргентина', 'argentina', 'чили', 'chile',
  'колумбия', 'colombia', 'перу', 'peru', 'венесуэла', 'venezuela',
];

const RUSSIA = new Set(['россия', 'russia', 'рф', 'russian federation']);

const MAP = new Map();
EUROPE.forEach((c) => MAP.set(c, 'europe'));
ASIA.forEach((c) => MAP.set(c, 'asia'));
AMERICA.forEach((c) => MAP.set(c, 'america'));

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/[.\s]+$/, '');
}

/** 'europe' | 'asia' | 'america' | null */
export function regionOf(country) {
  return MAP.get(norm(country)) || null;
}

export function isRussia(country) {
  return RUSSIA.has(norm(country));
}

/** Does a country fall under the selected region-filter value? */
export function matchesRegion(country, filter) {
  if (!filter || filter === 'all') return true;
  const r = regionOf(country);
  if (filter === 'europe') return r === 'europe';
  if (filter === 'europe_no_ru') return r === 'europe' && !isRussia(country);
  if (filter === 'asia') return r === 'asia';
  if (filter === 'america') return r === 'america';
  return true;
}

export const REGION_OPTIONS = [
  { value: 'all', label: 'Регион: все' },
  { value: 'europe', label: 'Европа' },
  { value: 'europe_no_ru', label: 'Европа без России' },
  { value: 'asia', label: 'Азия' },
  { value: 'america', label: 'Америка' },
];
