import type {Metadata} from 'next';
import {Be_Vietnam_Pro} from 'next/font/google';
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getTranslations} from 'next-intl/server';
import {cookies} from 'next/headers';
import {Toaster} from 'sonner';

import {TOKEN_COOKIE} from '@/core/auth/redirect';
import {SessionProvider} from '@/core/auth/session-provider';

import './globals.css';

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('core.meta');
  return {title: {default: 'LinMaster', template: '%s · LinMaster'}, description: t('description')};
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const locale = await getLocale();
  const signedIn = Boolean((await cookies()).get(TOKEN_COOKIE)?.value);
  return (
    <html lang={locale} className={font.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>
          <SessionProvider initialSignedIn={signedIn}>{children}</SessionProvider>
        </NextIntlClientProvider>
        {/* Toasts: call toast() from 'sonner' anywhere. Top centre keeps them clear of the mobile tab bar. */}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
