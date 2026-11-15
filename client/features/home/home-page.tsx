'use client';

import {
  DueSummaryResponseSchema,
  ListAttemptsResponseSchema,
  ListVocabDocumentsResponseSchema,
  StatsActivityResponseSchema,
  StatsOverviewResponseSchema,
} from '@linmaster/shared';
import {Brain, CloudOff, RotateCw} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useCallback, useEffect, useState} from 'react';

import {cn} from 'cn';
import {Button, buttonVariants} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {Skeleton} from '@/components/ui/skeleton';
import {api} from '@/core/api/client';
import {useSession} from '@/core/auth/session-provider';

import {greeting, runningAttempt, vnDay} from './home-logic';
import {card, homeWidgets, ONBOARDING, type HomeData} from './widgets';

/** `/home` (PLAN C7, wireframe 02-app/home): what to do today, from the home widget registry. */
export function HomePage() {
  const t = useTranslations('core.home');
  const format = useFormatter();
  const {user} = useSession();
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    const now = new Date();
    setFailed(false);
    setData(null);
    Promise.all([
      api('/stats/overview'),
      api(`/stats/activity?from=${vnDay(now, -6)}&to=${vnDay(now)}`),
      api('/flashcards/due-summary'),
      api('/attempts'),
      api('/vocab/documents'),
    ])
      .then(([overview, activity, due, attempts, documents]) =>
        setData({
          now,
          overview: StatsOverviewResponseSchema.parse(overview),
          activity: StatsActivityResponseSchema.parse(activity),
          due: DueSummaryResponseSchema.parse(due),
          running: runningAttempt(ListAttemptsResponseSchema.parse(attempts).attempts, now),
          documents: ListVocabDocumentsResponseSchema.parse(documents).documents.toSorted((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt),
          ),
        }),
      )
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const now = data?.now ?? new Date();
  // A new account has nothing to continue yet: show the first steps instead of empty widgets.
  const isNew =
    data !== null &&
    !data.running &&
    data.documents.length === 0 &&
    data.due.dueCount === 0 &&
    data.overview.words === 0 &&
    data.overview.testsTaken === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="glow relative overflow-hidden rounded-[28px] px-6 py-8 sm:px-10 sm:py-10">
        <p className="eyebrow">{format.dateTime(now, {weekday: 'long', day: '2-digit', month: '2-digit'})}</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {t(`greeting.${greeting(now)}`, {name: user?.displayName ?? ''})}
        </h1>
        {data && (
          <p className="mt-2 text-foreground/75">
            {isNew
              ? t('startHint')
              : t.rich('today', {
                  cards: data.due.dueCount,
                  running: data.running ? 'yes' : 'no',
                  b: s => <strong className="text-foreground">{s}</strong>,
                })}
          </p>
        )}
        {data && !isNew && (
          <div className="mt-5 flex flex-wrap gap-2">
            {data.due.dueCount > 0 && (
              <Link
                href={data.due.sets.length === 1 ? `/flashcards/${data.due.sets[0].setId}/study/learn` : '/flashcards'}
                className={buttonVariants({className: 'h-11'})}
              >
                <Brain className="size-4" aria-hidden="true" />
                {t('review', {count: data.due.dueCount})}
              </Link>
            )}
            <Link href="/read" className={buttonVariants({variant: 'secondary', className: 'h-11 bg-white/80'})}>
              {t('readNew')}
            </Link>
          </div>
        )}
      </header>

      {failed ? (
        <EmptyState
          icon={CloudOff}
          title={t('loadError')}
          action={
            <Button variant="outline" onClick={load}>
              <RotateCw className="size-4" aria-hidden="true" />
              {t('retry')}
            </Button>
          }
        />
      ) : !data ? (
        <div role="status" aria-busy="true" className="grid gap-4 lg:grid-cols-3">
          <span className="sr-only">{t('loading')}</span>
          <Skeleton className="h-40 rounded-[20px] lg:col-span-2" />
          <Skeleton className="h-40 rounded-[20px]" />
          <Skeleton className="h-48 rounded-[20px] lg:col-span-2" />
          <Skeleton className="h-48 rounded-[20px]" />
        </div>
      ) : isNew ? (
        <ul aria-label={t('onboarding.label')} className="grid gap-4 md:grid-cols-3">
          {ONBOARDING.map(({id, href, icon: Icon}, i) => (
            <li key={id}>
              <Link
                href={href}
                className={cn(
                  card,
                  'flex h-full flex-col gap-3 p-6 outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring',
                )}
              >
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-bold">
                  {i + 1}. {t(`onboarding.${id}.title`)}
                </span>
                <span className="text-sm text-muted-foreground">{t(`onboarding.${id}.body`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(['main', 'side'] as const).map(place => (
            <div
              key={place}
              // The last widget of a column stretches, so both columns end on the same line.
              className={cn(
                'flex min-w-0 flex-col gap-4 [&>section:last-child]:flex-1',
                place === 'main' && 'lg:col-span-2',
              )}
            >
              {homeWidgets
                .filter(w => w.place === place)
                .map(({id, Component}) => (
                  <Component key={id} data={data} />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
