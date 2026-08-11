import './globals.css';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

// Cloudflare's legacy next-on-pages adapter requires generated routes such as
// /_not-found to inherit the Edge runtime from their nearest layout.
export const runtime = 'edge';

export const metadata = {
  icons: {
    icon: '/favicon.webp',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased">
        <ToastProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
