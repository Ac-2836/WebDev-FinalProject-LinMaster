import {CircleAlert, Clock, Lock} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';

import {cn} from 'cn';
import {Logo} from '@/components/logo';
import {LocaleToggle} from '@/core/i18n/locale-switcher';

import {CardDrift} from './auth-motion';

interface AuthShellProps {
  title: string;
  subtitle: string;
  /** Decorative panel shown from 1024px. */
  aside: React.ReactNode;
  children: React.ReactNode;
}

/** Layout shared by /login and /register: form on white, product visual on a glow panel (wireframe 01-public). */
export function AuthShell({title, subtitle, aside, children}: AuthShellProps) {
  const t = useTranslations('auth');
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1fr_1.05fr]">
      <main id="main" className="relative isolate flex flex-col px-4 py-6 sm:px-10">
        {/* Faint behind the form on small screens, where the side panel is hidden. */}
        <CardDrift className="-z-10 opacity-15 lg:hidden" />
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex h-11 items-center rounded-xl" aria-label={t('homeLink')}>
            <Logo />
          </Link>
          <LocaleToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-7 py-12">
          <div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">{title}</h1>
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
        <p className="text-center text-[13px] text-muted-foreground">© 2026 LinMaster</p>
      </main>
      <aside
        className="relative isolate hidden items-center justify-center overflow-hidden p-12 glow-strong lg:flex"
        aria-hidden="true"
      >
        <CardDrift className="-z-10 opacity-50" />
        {aside}
      </aside>
    </div>
  );
}

const NOTICE = {
  info: {icon: Lock, className: 'bg-secondary text-primary'},
  error: {icon: CircleAlert, className: 'bg-danger-soft text-destructive'},
  warning: {icon: Clock, className: 'bg-warning-soft text-warning'},
};

export interface NoticeProps {
  tone: keyof typeof NOTICE;
  children: React.ReactNode;
}

/** Message box above a form. Errors and warnings are announced to screen readers. */
export function Notice({tone, children}: NoticeProps) {
  const {icon: Icon, className} = NOTICE[tone];
  return (
    <div role={tone === 'info' ? undefined : 'alert'} className={cn('flex gap-2 rounded-2xl p-3.5 text-sm', className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
