'use client';

import {useTranslations} from 'next-intl';
import Link from 'next/link';

import {Button} from '@/components/ui/button';
import {useSession} from '@/core/auth/session-provider';

/** The landing header buttons: sign in / start for a visitor, one way into the app for someone already signed in. */
export function LandingActions() {
  const t = useTranslations('core.landing');
  const {status} = useSession();
  if (status === 'ready') {
    return (
      <Button asChild className="h-10 rounded-full">
        <Link href="/home">{t('enter')}</Link>
      </Button>
    );
  }
  return (
    <>
      <Button asChild variant="outline" className="h-10 rounded-full">
        <Link href="/login">{t('login')}</Link>
      </Button>
      <Button asChild className="hidden h-10 rounded-full sm:inline-flex">
        <Link href="/register">{t('start')}</Link>
      </Button>
    </>
  );
}
