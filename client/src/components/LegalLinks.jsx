import { Link } from 'react-router-dom';
import { LEGAL_DOCS } from '../lib/legalDocs.js';
import { useLang } from '../i18n.jsx';

// One list of the site's legal documents, reused by the footer, the /legal index
// and the funnel forms. Paths come from lib/legalDocs.js (mirror of the server's
// version file) rather than being retyped at each link site — the offer and the
// PDn consent must never be linked at a URL the acceptance gate doesn't know
// about, and a version bump there should not require touching every link.
//
// Only the *labels* are translated. The documents themselves are Russian-only by
// design (binding contract, KZ law governs — see the header comment in
// pages/legal/Offer.jsx), which is why the EN copy says so out loud.
const L = {
  ru: {
    nav: 'Правовые документы',
    offer: 'Публичная оферта',
    offerHint: 'Договор с креатором: тарифная сетка, учёт просмотров, выплаты, налоги.',
    pdn: 'Согласие на обработку персональных данных',
    pdnHint: 'Какие данные собираем, зачем, кому передаём и как отозвать согласие.',
    privacy: 'Политика конфиденциальности',
    privacyHint: 'Cookie, аналитика, трансграничная передача данных.',
    terms: 'Условия использования',
    termsHint: 'Общие правила работы с платформой для бизнеса и креаторов.',
    offerShort: 'публичной офертой',
    pdnShort: 'согласием на обработку персональных данных',
    notePre: 'Отправляя заявку, вы подтверждаете, что ознакомились с ',
    noteMid: ' и ',
    notePost: '.',
    noteBusinessPre: 'Отправляя заявку, вы подтверждаете, что ознакомились с ',
    noteBusinessPost: '.',
  },
  en: {
    nav: 'Legal documents',
    offer: 'Public offer',
    offerHint: 'The creator contract: rate card, view counting, payouts, taxes.',
    pdn: 'Personal data consent',
    pdnHint: 'What we collect, why, who we share it with, and how to withdraw consent.',
    privacy: 'Privacy policy',
    privacyHint: 'Cookies, analytics, cross-border data transfers.',
    terms: 'Terms of Service',
    termsHint: 'General rules for businesses and creators using the platform.',
    offerShort: 'the public offer',
    pdnShort: 'the personal data consent',
    notePre: 'By submitting this form you confirm that you have read ',
    noteMid: ' and ',
    notePost: ' (both published in Russian — the language of the contract).',
    noteBusinessPre: 'By submitting this form you confirm that you have read ',
    noteBusinessPost: ' (published in Russian — the language of the contract).',
  },
};

/**
 * The four public legal documents, in the order they should be shown:
 * contract first, then consent, then the site-level policies.
 * `version` is present only for the two gated documents.
 */
export function legalDocLinks(lang) {
  const t = L[lang] || L.ru;
  return [
    {
      path: LEGAL_DOCS.offer.path,
      label: t.offer,
      hint: t.offerHint,
      version: LEGAL_DOCS.offer.version,
    },
    {
      path: LEGAL_DOCS.personal_data_consent.path,
      label: t.pdn,
      hint: t.pdnHint,
      version: LEGAL_DOCS.personal_data_consent.version,
    },
    { path: '/privacy', label: t.privacy, hint: t.privacyHint },
    { path: '/terms', label: t.terms, hint: t.termsHint },
  ];
}

/** Plain vertical list of legal links — used in the footer's "Документы" column. */
export default function LegalLinks({ onNavigate }) {
  const { lang } = useLang();
  const t = L[lang] || L.ru;
  return (
    <nav className="legal-links" aria-label={t.nav}>
      {legalDocLinks(lang).map(({ path, label }) => (
        <Link key={path} to={path} onClick={onNavigate} data-track={`legal-link:${path}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Small print under a funnel lead form. Deliberately says "ознакомились" and not
 * "принимаете": acceptance is a separate, logged event recorded at registration
 * (see legal_acceptances / RegisterCreator.jsx), and a marketing lead form must
 * not be presented as the moment the contract is concluded.
 */
export function LegalNote({ role = 'creator' }) {
  const { lang } = useLang();
  const t = L[lang] || L.ru;

  const offerLink = (
    <Link to={LEGAL_DOCS.offer.path} target="_blank" rel="noreferrer" data-track="legal-note:offer">
      {t.offerShort}
    </Link>
  );
  const pdnLink = (
    <Link
      to={LEGAL_DOCS.personal_data_consent.path}
      target="_blank"
      rel="noreferrer"
      data-track="legal-note:personal-data-consent"
    >
      {t.pdnShort}
    </Link>
  );

  // Businesses accept only the PDn consent (REQUIRED_DOCS in server/src/legalDocs.js)
  // — pointing them at the creator offer would be misleading.
  if (role === 'business') {
    return (
      <p className="legal-note">
        {t.noteBusinessPre}
        {pdnLink}
        {t.noteBusinessPost}
      </p>
    );
  }

  return (
    <p className="legal-note">
      {t.notePre}
      {offerLink}
      {t.noteMid}
      {pdnLink}
      {t.notePost}
    </p>
  );
}
