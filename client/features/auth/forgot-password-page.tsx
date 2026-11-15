import {KeyRound} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';

import {buttonVariants} from '@/components/ui/button';

import {AuthShell, Notice} from './auth-shell';

/**
 * `/forgot-password` (UX-2): how to get back in. Sending a reset email needs an email service, which the project
 * does not have yet, so the page says so instead of pretending to send one.
 */
export function ForgotPasswordPage() {
  const t = useTranslations('auth.forgot');
  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      aside={
        <span className="inline-flex size-40 items-center justify-center rounded-[40px] bg-white/90 text-primary shadow-lift">
          <KeyRound className="size-20" />
        </span>
      }
    >
      <Notice tone="info">{t('notReady')}</Notice>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
        <li>{t('remember')}</li>
        <li>{t('forgotten')}</li>
      </ol>
      <Link href="/login" className={buttonVariants({size: 'lg', className: 'h-12 w-full rounded-full text-base'})}>
        {t('back')}
      </Link>
    </AuthShell>
  );
}
