import { Helmet } from 'react-helmet-async';
import { useLang } from '../i18n.jsx';
import { SITE_URL } from '../lib/config.js';

// Canonical production origin — single source of truth (config.js / VITE_SITE_URL),
// so canonical + OG URLs always match the domain used for shareable links.
const ORIGIN = SITE_URL;

/**
 * Per-page meta: title, description, canonical, Open Graph + Twitter Card,
 * robots and locale. Pass `noindex` for private/thin pages (cabinet, thank-you).
 */
export default function Seo({ title, description, path = '/', image = '/og-image.jpg', noindex = false }) {
  const { lang } = useLang();
  const url = `${ORIGIN}${path}`;
  const imageUrl = image.startsWith('http') ? image : `${ORIGIN}${image}`;
  const locale = lang === 'en' ? 'en_US' : 'ru_RU';

  return (
    <Helmet>
      {/* The <html lang> attribute is owned by LangProvider (i18n.jsx). */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta
        name="robots"
        content={noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1'}
      />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="CLICKI" />
      <meta property="og:locale" content={locale} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
}
