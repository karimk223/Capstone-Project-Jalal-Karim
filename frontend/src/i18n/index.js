/**
 * i18n setup.
 * Addresses Gap 7 (Arabic-only legacy UI with raw English errors leaking through)
 * and satisfies NFR-4 (every user-facing string routed through react-i18next).
 *
 * MVP ships English only. Arabic (ar.json) is Future Work — adding it must
 * NOT require code changes, only a new JSON file dropped in this folder and
 * registered in the `resources` block below.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    // ar: { translation: ar },  // Future Work — keep this comment as a marker
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes by default
  },
});

export default i18n;
