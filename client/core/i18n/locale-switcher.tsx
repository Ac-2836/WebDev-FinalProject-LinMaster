'use client';

import {Globe} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {useTransition} from 'react';

import {Button} from '@/components/ui/button';

import {setLocale} from './actions';
import {type Locale, locales} from './config';

function useSwitchLocale() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const change = (locale: Locale) =>
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  return {pending, change};
}

/** One button per language. Used on public pages. */
export function LocaleSwitcher() {
  const t = useTranslations('core.localeSwitcher');
  const current = useLocale();
  const {pending, change} = useSwitchLocale();

  return (
    <div role="group" aria-label={t('label')} className="inline-flex gap-2">
      {locales.map(locale => (
        <Button
          key={locale}
          size="sm"
          variant={locale === current ? 'default' : 'outline'}
          aria-pressed={locale === current}
          disabled={pending}
          onClick={() => change(locale)}
        >
          {t(locale)}
        </Button>
      ))}
    </div>
  );
}

/** Compact toggle for the app navbar: shows the current language, switches to the other one. */
export function LocaleToggle() {
  const t = useTranslations('core.localeSwitcher');
  const current = useLocale() as Locale;
  const next = locales.find(l => l !== current) ?? current;
  const {pending, change} = useSwitchLocale();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => change(next)}
      aria-label={t('toggle', {current: t(current), next: t(next)})}
    >
      <Globe aria-hidden="true" />
      {current.toUpperCase()}
    </Button>
  );
}
