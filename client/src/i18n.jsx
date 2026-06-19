import { createContext, useContext, useEffect, useState } from 'react';

const LangContext = createContext({ lang: 'ru', setLang: () => {} });

/** Provides the current UI language (ru | en), persisted to localStorage. */
export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof localStorage === 'undefined') return 'ru';
    return localStorage.getItem('clicki_lang') || 'ru';
  });

  useEffect(() => {
    localStorage.setItem('clicki_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
