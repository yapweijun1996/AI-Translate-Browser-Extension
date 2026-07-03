// Target-translation-language list for the options page picker. Labels are
// each language's own native name (not translated per UI locale) — a
// speaker recognizes "Français"/"日本語" regardless of what language the
// extension's own UI happens to be in, and it avoids needing ~20 extra
// strings translated into all 6 UI locales for something that isn't UI text.
//
// Codes are short (e.g. 'fr', not 'fr-FR') to match what main.js already
// sends engines today (navigator.language?.split('-')[0]) — engines just
// interpolate this into a prompt ("translating ... to fr"), so consistency
// with the existing convention matters more than full BCP-47 precision here.

export const TARGET_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ภาษาไทย' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'pl', label: 'Polski' },
];

export const DEFAULT_TARGET_LANGUAGE = 'en';

/** chrome.storage.local key the options page writes and the content script reads. */
export const TARGET_LANG_STORAGE_KEY = 'targetLang';
