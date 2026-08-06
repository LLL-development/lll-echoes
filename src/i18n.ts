import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { locales, defaultLocale, type Locale } from './i18n/config';

function resolveLocaleFromAcceptLanguage(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;

  const supported = new Set(locales);

  // Parse: "ja-JP;q=0.9,en;q=0.8,zh-CN;q=0.7"
  const entries = acceptLanguage
    .split(',')
    .map(part => {
      const trimmed = part.trim();
      const [langPart, qPart] = trimmed.split(';');
      const q = qPart?.includes('q=') ? parseFloat(qPart.split('=')[1]) : 1;
      return { lang: langPart.trim().toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of entries) {
    // Exact match
    if (supported.has(lang as Locale)) return lang as Locale;

    // Base language match
    const base = lang.split('-')[0];
    if (base === 'zh') {
      // Check for script subtag to distinguish Simplified vs Traditional
      if (lang.includes('hant')) {
        if (supported.has('zh-TW')) return 'zh-TW';
      } else {
        if (supported.has('zh')) return 'zh';
      }
    } else if (base === 'en' || base === 'ja' || base === 'ko' || base === 'ms') {
      if (supported.has(base as Locale)) return base as Locale;
    }
  }

  return null;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: Locale = defaultLocale;

  if (requested && (locales as readonly string[]).includes(requested)) {
    locale = requested as Locale;
  } else {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
    if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
      locale = cookieLocale as Locale;
    } else {
      const acceptLanguage = (await headers()).get('accept-language');
      const alLocale = resolveLocaleFromAcceptLanguage(acceptLanguage);
      if (alLocale) {
        locale = alLocale;
      }
    }
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
