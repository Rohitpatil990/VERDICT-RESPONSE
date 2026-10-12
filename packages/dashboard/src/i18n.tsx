import React, { createContext, useContext, useState, useEffect } from 'react';

// Embedded starting translations for reliable bundled operation
import enDict from '../../../assets/i18n/en.json';
import hiDict from '../../../assets/i18n/hi.json';
import mrDict from '../../../assets/i18n/mr.json';

export type Language = 'en' | 'hi' | 'mr';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const dictionaries: Record<Language, any> = {
  en: enDict,
  hi: hiDict,
  mr: mrDict
};

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key: string) => key
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('verdict_lang') as Language) || 'en';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('verdict_lang', newLang);
  };

  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    let current = dictionaries[lang];
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        // Fallback to English
        let fallback = dictionaries['en'];
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in fallback) {
            fallback = fallback[fk];
          } else {
            return path;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') return path;

    let res = current;
    if (params) {
      for (const [pKey, pVal] of Object.entries(params)) {
        res = res.replace(new RegExp(`{{${pKey}}}`, 'g'), String(pVal));
      }
    }
    return res;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
