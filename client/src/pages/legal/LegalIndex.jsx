import { Link } from 'react-router-dom';
import Seo from '../../components/Seo.jsx';
import Header from '../../components/Header.jsx';
import Footer from '../../components/Footer.jsx';
import { useLang } from '../../i18n.jsx';
import { legalDocLinks } from '../../components/LegalLinks.jsx';

// Landing for every public legal document. Exists so the header can carry one
// nav item instead of a growing list of policy links, and so the public offer
// has a discoverable, linkable home (/legal → offer first) rather than being
// reachable only from the registration checkbox and the acceptance gate.
const COPY = {
  ru: {
    seoTitle: 'Правовые документы - CLICKI',
    seoDesc:
      'Публичная оферта, согласие на обработку персональных данных, политика конфиденциальности и условия использования платформы CLICKI.',
    title: 'Правовые документы',
    lead:
      'Действующие редакции документов CLICKI. Публичная оферта и согласие на обработку персональных данных опубликованы на русском языке — это язык договора; переводы носят информационный характер.',
    open: 'Открыть',
    version: 'Редакция',
    requisitesTitle: 'Реквизиты',
    requisites: `ТОО «CLICKI Labs»
БИН: 260740019117
Место нахождения: 010000, Республика Казахстан, город Астана, район Нура, улица Ілияс Омаров, дом 27/1, квартира 7
Адрес для юридически значимых сообщений: info@clicki-platform.com`,
  },
  en: {
    seoTitle: 'Legal documents - CLICKI',
    seoDesc:
      'Public offer, personal data consent, privacy policy and terms of service for the CLICKI platform.',
    title: 'Legal documents',
    lead:
      'The current versions of CLICKI’s documents. The public offer and the personal data consent are published in Russian — the language of the contract; translations are informational only.',
    open: 'Open',
    version: 'Version',
    requisitesTitle: 'Company details',
    requisites: `CLICKI Labs LLP
BIN: 260740019117
Registered address: 010000, Republic of Kazakhstan, Astana, Nura district, Ilyas Omarov street, 27/1, apt. 7
Address for legally significant notices: info@clicki-platform.com`,
  },
};

export default function LegalIndex() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;
  const docs = legalDocLinks(lang);

  return (
    <>
      <Seo title={t.seoTitle} description={t.seoDesc} path="/legal" />
      <Header variant="hub" />
      <main className="page page--legal">
        <div className="container page__inner">
          <h1 className="page__title">{t.title}</h1>
          <p className="page__lead">{t.lead}</p>

          <div className="legal-docs">
            {docs.map(({ path, label, hint, version }) => (
              <Link className="legal-doc-card" to={path} key={path} data-track={`legal-index:${path}`}>
                <span className="legal-doc-card__title">{label}</span>
                <span className="legal-doc-card__hint">{hint}</span>
                <span className="legal-doc-card__foot">
                  {version && (
                    <span className="legal-doc-card__meta">
                      {t.version}: {version}
                    </span>
                  )}
                  <span className="legal-doc-card__cta">{t.open} →</span>
                </span>
              </Link>
            ))}
          </div>

          <section className="legal-article">
            <h2 className="legal-article__title">{t.requisitesTitle}</h2>
            <p className="legal-article__text" style={{ whiteSpace: 'pre-line' }}>
              {t.requisites}
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
