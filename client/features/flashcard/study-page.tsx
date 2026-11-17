'use client';

import {GetFlashcardSetResponseSchema, type FlashcardSet} from '@linmaster/shared';
import {CloudOff, Layers, RotateCw} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useCallback, useEffect, useState} from 'react';

import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {Skeleton} from '@/components/ui/skeleton';
import {api, isNotFound} from '@/core/api/client';

import {findStudyMode} from './study-modes';

export interface StudyPageProps {
  id: string;
  mode: string;
}

/** `/flashcards/[id]/study/[mode]`: loads the set, then renders the mode from the study mode registry. */
export function StudyPage({id, mode}: StudyPageProps) {
  const t = useTranslations('flashcard.study');
  const entry = findStudyMode(mode);
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [error, setError] = useState<'notFound' | 'failed' | null>(null);

  const load = useCallback(() => {
    setError(null);
    api(`/flashcards/sets/${id}`)
      .then(res => setSet(GetFlashcardSetResponseSchema.parse(res).set))
      .catch(err => setError(isNotFound(err) ? 'notFound' : 'failed'));
  }, [id]);
  useEffect(load, [load]);

  const frame = (children: React.ReactNode) => (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-4 px-4 py-8 glow">
      {children}
    </main>
  );

  if (!entry || error === 'notFound') {
    return frame(
      <EmptyState
        icon={Layers}
        title={entry ? t('setNotFound') : t('modeNotFound')}
        action={
          <Button asChild className="h-11 rounded-full px-5">
            <Link href={entry ? '/flashcards' : `/flashcards/${id}`}>{t('backToSet')}</Link>
          </Button>
        }
      />,
    );
  }
  if (error) {
    return frame(
      <div role="alert" className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
          <CloudOff className="size-6" aria-hidden="true" />
        </span>
        <p className="font-bold">{t('loadError')}</p>
        <Button variant="outline" className="h-10 rounded-full" onClick={load}>
          <RotateCw aria-hidden="true" />
          {t('retry')}
        </Button>
      </div>,
    );
  }
  if (!set) {
    return frame(
      <div className="flex flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
        <Skeleton className="mx-auto h-5 w-1/3" />
        <Skeleton className="aspect-[4/3] w-full rounded-[20px] sm:aspect-[16/9]" />
      </div>,
    );
  }
  const Mode = entry.component;
  return <Mode set={set} />;
}
