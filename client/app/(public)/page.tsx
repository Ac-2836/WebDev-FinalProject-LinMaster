import {useTranslations} from 'next-intl';

import {LocaleSwitcher} from '@/core/i18n/locale-switcher';

// Placeholder until the landing page (P1-12).
export default function HomePlaceholder() {
  const t = useTranslations('core.placeholder');
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('body')}</p>
      <LocaleSwitcher />
    </main>
  );
}
