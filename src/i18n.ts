import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './i18n/config';

function parseAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;
  const parts = header.split(',').map((p) => p.split(';')[0].trim().toLowerCase());
  for (const part of parts) {
    if (part === 'zh-tw' || part === 'zh-hant') return 'zh-TW';
    if (part.startsWith('zh')) return 'zh';
    if (part.startsWith('ja')) return 'ja';
    if (part.startsWith('ko')) return 'ko';
    if (part.startsWith('ms')) return 'ms';
    if (part.startsWith('en')) return 'en';
  }
  return defaultLocale;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: Locale = defaultLocale;
  if (requested && (locales as readonly string[]).includes(requested)) {
    locale = requested as Locale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
