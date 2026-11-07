import {useTranslations} from 'next-intl';

import {Skeleton} from '@/components/ui/skeleton';

// Shown while a page in the app shell loads (Next.js route-level Suspense fallback).
export default function AppLoading() {
  const t = useTranslations('core');
  return (
    <div aria-busy="true" aria-label={t('loading')} className="flex flex-col gap-4">
      <Skeleton className="h-8 w-1/3" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
