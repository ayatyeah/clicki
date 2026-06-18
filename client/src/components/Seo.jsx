import { Helmet } from 'react-helmet-async';

/** Per-page meta: title, description, Open Graph + Twitter Card. */
export default function Seo({ title, description, path = '/', image = '/logo-full.jpg' }) {
  const origin = 'https://clicki.kz';
  const url = `${origin}${path}`;
  const imageUrl = image.startsWith('http') ? image : `${origin}${image}`;
  return (
    <Helmet>
      <html lang="ru" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="CLICKI" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
}
