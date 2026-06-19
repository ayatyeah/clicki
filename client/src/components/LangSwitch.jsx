import { useLang } from '../i18n.jsx';

/** RU / EN language toggle. */
export default function LangSwitch({ className = '' }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label="Language">
      <button type="button" className={lang === 'ru' ? 'is-active' : ''} onClick={() => setLang('ru')}>
        RU
      </button>
      <span aria-hidden="true">/</span>
      <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
        EN
      </button>
    </div>
  );
}
