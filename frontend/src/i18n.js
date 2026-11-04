import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.js';
import en from './locales/en.js';
import ja from './locales/ja.js';
import { getLanguageSettings, normalizeLanguage } from './locales/languages.js';

i18n.use(initReactI18next).init({
  lng: 'zh',
  supportedLngs: ['zh', 'en', 'ja'],
  load: 'languageOnly',
  fallbackLng: 'zh',
  resources: { zh: { translation: zh }, en: { translation: en }, ja: { translation: ja } },
  initAsync: false,
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: true,
  interpolation: {
    escapeValue: false,
  },
});

// Utilities and chart builders bind a language explicitly, independently of UI state.
export function getTranslator(language = 'zh') {
  return i18n.getFixedT(normalizeLanguage(language));
}

function syncDocumentLanguage(language) {
  if (typeof document !== 'undefined') document.documentElement.lang = getLanguageSettings(language).lang;
}
i18n.on('languageChanged', syncDocumentLanguage);
syncDocumentLanguage(i18n.language);

export default i18n;
