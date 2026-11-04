import type {Metadata} from 'next';
import {Be_Vietnam_Pro} from 'next/font/google';
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getTranslations} from 'next-intl/server';

import './globals.css';

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('core.meta');
  return {title: 'LinMaster', description: t('description')};
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={font.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
