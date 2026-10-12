import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from '../../../assets/i18n/en.json';
import hiTranslations from '../../../assets/i18n/hi.json';
import mrTranslations from '../../../assets/i18n/mr.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    hi: { translation: hiTranslations },
    mr: { translation: mrTranslations }
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
