export const locales = ['en', 'ja', 'zh', 'zh-TW', 'ko', 'ms'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  zh: '简体中文',
  'zh-TW': '繁體中文',
  ko: '한국어',
  ms: 'Bahasa Melayu',
};
