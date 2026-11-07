'use client';

import {RotateCcw, TriangleAlert} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';

import {Button} from '@/components/ui/button';

// Error boundary for every route below the root layout. `digest` lets the team find the server log entry.
export default function ErrorPage({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
  const t = useTranslations('core.error');
  return (
    <main
      id="main"
      role="alert"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-danger-soft text-destructive">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('body')}</p>
      {error.digest && <p className="text-xs text-muted-foreground">{t('code', {code: error.digest})}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw aria-hidden="true" />
          {t('retry')}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/home">{t('home')}</Link>
        </Button>
      </div>
    </main>
  );
}
