import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, defaultLocale, type Locale } from './i18n/config';

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
    }
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
