import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Logo from '../components/Logo.jsx';
import { useLang } from '../i18n.jsx';
import { API_BASE } from '../lib/config.js';
import { safeHref } from '../lib/safeHref.js';

const COPY = {
  ru: { tag: 'UGC-креатор на CLICKI', cta: 'Заказать похожий контент', desc: (n) => `Профиль ${n} на CLICKI` },
  en: { tag: 'UGC creator on CLICKI', cta: 'Order similar content', desc: (n) => `${n} on CLICKI` },
};

/** Turn a freeform social-link token into a clickable href, best-effort. */
function toHref(token) {
  if (/^https?:\/\//i.test(token)) return token;
  if (/\.[a-z]{2,}(\/|$)/i.test(token)) return `https://${token}`;
  return null;
}

/**
 * Public "link in bio" mini-page: clicki-platform.com/ref/<login>.
 * A creator puts this in their social profile header. Shows the brands they've
 * worked with (pulled from accepted briefs) and their own social links.
 * Also remembers the visit as a referral so a later business lead credits this
 * creator (server/src/index.js handleLead → recordReferralLead), and the fetch
 * itself bumps the creator's click counter server-side.
 *
 * `legacyRedirect` is set for the old bare "/<login>" route: it forwards to the
 * canonical /ref/<login> so links shared before the move keep working.
 */
export default function CreatorMiniPage({ legacyRedirect = false }) {
  const { login } = useParams();
  const navigate = useNavigate();
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;
  const [page, setPage] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (legacyRedirect) {
      navigate(`/ref/${encodeURIComponent(login)}`, { replace: true });
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/creator-page/${encodeURIComponent(login)}`);
        const d = await r.json();
        if (!alive) return;
        if (r.ok && d && d.id) {
          localStorage.setItem('clicki_ref', String(d.id));
          setPage(d);
        } else {
          setNotFound(true);
        }
      } catch {
        if (alive) setNotFound(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [login, legacyRedirect, navigate]);

  useEffect(() => {
    if (notFound) navigate('/', { replace: true });
  }, [notFound, navigate]);

  if (!page) return null;

  const socials = (page.socials || '')
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <main className="creator-page page-light app-light">
      <Seo title={`${page.name} — CLICKI`} description={t.desc(page.name)} path={`/ref/${login}`} noindex />
      <div className="creator-page__inner">
        <Logo to="/" />
        <h1 className="creator-page__name">{page.name}</h1>
        <p className="creator-page__tag">{t.tag}</p>

        {page.brandLinks.length > 0 && (
          <div className="creator-page__brands">
            {/* Через наш трекинг-редирект: он засчитает переход и перекинет на сайт
                бренда. Показываем плашку только если у брифа есть валидная ссылка. */}
            {page.brandLinks.filter((b) => safeHref(b.url)).map((b) => (
              <a
                key={b.briefId}
                href={`${API_BASE}/api/go/brand/${b.briefId}?ref=${page.id}`}
                target="_blank"
                rel="noreferrer"
                className="creator-page__brand"
              >
                <span className="creator-page__brand-name">{b.brand || b.title}</span>
                {b.brand && <span className="creator-page__brand-sub">{b.title}</span>}
              </a>
            ))}
          </div>
        )}

        <div className="creator-page__cta">
          <Link to="/business" className="btn btn--primary">{t.cta}</Link>
        </div>

        {socials.length > 0 && (
          <div className="creator-page__socials">
            {socials.map((s, i) => {
              const href = toHref(s);
              return href ? (
                <a key={i} href={href} target="_blank" rel="noreferrer" className="creator-page__social">{s}</a>
              ) : (
                <span key={i} className="creator-page__social creator-page__social--plain">{s}</span>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
