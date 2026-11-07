import {SearchX} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import {LogoMark} from '@/components/logo';
import {Button} from '@/components/ui/button';

// Global 404. Also used for content the user may not see (the API answers 403/404 and the page calls notFound()).
export default async function NotFound() {
  const t = await getTranslations('core.notFound');
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <LogoMark size={40} />
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
        <SearchX className="size-7" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('body')}</p>
      <Button asChild>
        <Link href="/home">{t('home')}</Link>
      </Button>
    </main>
  );
}
