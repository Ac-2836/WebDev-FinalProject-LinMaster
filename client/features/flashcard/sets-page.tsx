'use client';

import {DueSummaryResponseSchema, ListFlashcardSetsResponseSchema} from '@linmaster/shared';
import {CloudOff, Layers, NotebookPen, Pencil, Plus, RotateCw} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useCallback, useEffect, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {Skeleton} from '@/components/ui/skeleton';
import {api} from '@/core/api/client';

type Summary = {id: string; title: string; cardCount: number; due: number};
const card = 'flex flex-col gap-4 rounded-[20px] border bg-card p-5 shadow-soft';

/** `/flashcards` (C3, wireframe 04-flashcard/sets): the learner's sets with cards due today. */
export function SetsPage() {
  const t = useTranslations('flashcard.sets');
  const [sets, setSets] = useState<Summary[] | null>(null);
  const [dueTotal, setDueTotal] = useState(0);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setSets(null);
    Promise.all([api('/flashcards/sets'), api('/flashcards/due-summary')])
      .then(([list, due]) => {
        const summary = DueSummaryResponseSchema.parse(due);
        const dueBySet = new Map(summary.sets.map(s => [s.setId, s.dueCount]));
        setDueTotal(summary.dueCount);
        setSets(
          ListFlashcardSetsResponseSchema.parse(list).sets.map(s => ({
            id: s.id,
            title: s.title,
            cardCount: s.cardCount,
            due: dueBySet.get(s.id) ?? 0,
          })),
        );
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const newButton = (
    <Button asChild className="h-11 rounded-full px-5">
      <Link href="/flashcards/new">
        <Plus aria-hidden="true" />
        {t('new')}
      </Link>
    </Button>
  );
  const dueSets = sets?.filter(s => s.due > 0).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-muted-foreground">{t('eyebrow')}</p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">
            {t('title')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {sets && dueTotal > 0 ? t('dueToday', {count: dueTotal, sets: dueSets}) : t('subtitle')}
          </p>
        </div>
        <Button asChild variant="outline" className="h-11 rounded-full px-5">
          <Link href="/vocab">
            <NotebookPen aria-hidden="true" />
            {t('fromBank')}
          </Link>
        </Button>
        {newButton}
      </header>

      {failed ? (
        <div role="alert" className={cn(card, 'items-center p-10 text-center')}>
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
            <CloudOff className="size-6" aria-hidden="true" />
          </span>
          <p className="font-bold">{t('loadError')}</p>
          <Button variant="outline" className="h-10 rounded-full" onClick={load}>
            <RotateCw aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      ) : !sets ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label={t('loading')}>
          {Array.from({length: 3}, (_, i) => (
            <li key={i} className={cn(card, 'h-52')}>
              <Skeleton className="size-10 rounded-xl" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-auto h-10 w-full" />
            </li>
          ))}
        </ul>
      ) : sets.length === 0 ? (
        <EmptyState icon={Layers} title={t('emptyTitle')} description={t('emptyBody')} action={newButton} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map(s => (
            <li key={s.id} className={card}>
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <Layers className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <Link href={`/flashcards/${s.id}`} className="font-bold break-words hover:text-primary">
                  {s.title}
                </Link>
                <p className="text-[13px] text-muted-foreground">
                  {t('cardCount', {count: s.cardCount})}
                  {s.due > 0 && (
                    <>
                      {' · '}
                      <span className="font-semibold text-warning">{t('due', {count: s.due})}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="mt-auto flex gap-2">
                <Button asChild variant={s.due > 0 ? 'default' : 'outline'} className="h-10 flex-1 rounded-full">
                  <Link href={`/flashcards/${s.id}`}>{s.due > 0 ? t('studyNow') : t('open')}</Link>
                </Button>
                <Button asChild variant="ghost" size="icon" className="size-10">
                  <Link href={`/flashcards/${s.id}/edit`} aria-label={t('edit', {title: s.title})}>
                    <Pencil aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
