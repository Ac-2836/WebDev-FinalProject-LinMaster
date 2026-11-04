'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {useTransition} from 'react';

import {Button} from '@/components/ui/button';

import {setLocale} from './actions';
import {locales} from './config';

export function LocaleSwitcher() {
  const t = useTranslations('core.localeSwitcher');
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t('label')} className="inline-flex gap-2">
      {locales.map(locale => (
        <Button
          key={locale}
          size="sm"
          variant={locale === current ? 'default' : 'outline'}
          aria-pressed={locale === current}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setLocale(locale);
              router.refresh();
            })
          }
        >
          {t(locale)}
        </Button>
      ))}
    </div>
  );
}
