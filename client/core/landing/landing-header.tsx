import {useTranslations} from 'next-intl';
import Link from 'next/link';

import {Logo} from '@/components/logo';
import {Button} from '@/components/ui/button';
import {LocaleToggle} from '@/core/i18n/locale-switcher';

const SECTIONS = ['loop', 'reader', 'flashcard', 'exam'] as const;

/** Public header for the landing page (wireframe 01-public/landing). */
export function LandingHeader() {
  const t = useTranslations('core.landing');

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
      >
        {t('skip')}
      </a>
      <p className="bg-foreground px-4 py-2 text-center text-[13px] text-white/90">
        <span className="mr-1" aria-hidden="true">
          ✦
        </span>
        {t.rich('announce', {b: chunks => <strong className="text-white">{chunks}</strong>})}{' '}
        <Link href="/register" className="font-semibold text-[#b9cdff] underline-offset-2 hover:underline">
          {t('announceCta')}
        </Link>
      </p>
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="inline-flex h-11 items-center rounded-xl" aria-label={t('homeLink')}>
            <Logo />
          </Link>
          <nav aria-label={t('nav.label')} className="hidden items-center gap-1 text-sm font-semibold lg:flex">
            {SECTIONS.map(id => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex h-9 items-center rounded-full px-3 text-foreground/80 hover:bg-muted hover:text-foreground"
              >
                {t(`nav.${id}`)}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <LocaleToggle />
            <Button asChild variant="outline" className="h-10 rounded-full">
              <Link href="/login">{t('login')}</Link>
            </Button>
            <Button asChild className="hidden h-10 rounded-full sm:inline-flex">
              <Link href="/register">{t('start')}</Link>
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
