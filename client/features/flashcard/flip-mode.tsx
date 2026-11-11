'use client';

import type {FlashcardSet} from '@linmaster/shared';
import {ArrowLeft, ArrowRight, Layers, PartyPopper, Shuffle} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useEffect, useMemo, useRef, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';

import {StudyShell} from './study-shell';
import {useStudyKeys, useStudySession} from './study-session';

const kbd = 'rounded border bg-card px-1.5 font-mono text-xs';
const face =
  'absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[20px] border p-6 text-center shadow-lg [backface-visibility:hidden] sm:p-8';

/** Fisher–Yates shuffle of the card order. */
function shuffled(n: number) {
  const order = Array.from({length: n}, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Thẻ lật (C3, wireframe 04-flashcard/study-flip): Space flips, ←/→ move. Does not change SM-2 progress. */
export function FlipMode({set}: {set: FlashcardSet}) {
  const t = useTranslations('flashcard.study');
  const cards = useMemo(() => [...set.cards].sort((a, b) => a.position - b.position), [set]);
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [shuffle, setShuffle] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const cardButton = useRef<HTMLButtonElement>(null);
  const session = useStudySession(set.id, 'flip', cards.length > 0);

  useEffect(() => {
    if (!finished) cardButton.current?.focus();
  }, [finished]);

  function go(step: number) {
    const next = index + step;
    if (next < 0) return;
    if (next >= cards.length) {
      setFinished(true);
      void session.end({cardsStudied: cards.length});
      return;
    }
    setIndex(next);
    setFlipped(false);
  }
  function restart(nextShuffle = shuffle) {
    setOrder(nextShuffle ? shuffled(cards.length) : cards.map((_, i) => i));
    setIndex(0);
    setFlipped(false);
    setFinished(false);
  }

  useStudyKeys((key, e) => {
    if (finished) return;
    if (key === ' ') {
      e.preventDefault();
      setFlipped(f => !f);
    } else if (key === 'ArrowRight') go(1);
    else if (key === 'ArrowLeft') go(-1);
  });

  const shell = (children: React.ReactNode, progress?: React.ReactNode, actions?: React.ReactNode) => (
    <StudyShell
      setId={set.id}
      title={set.title}
      modeLabel={t('flip')}
      onExit={() => session.end({cardsStudied: finished ? cards.length : index})}
      progress={progress}
      actions={actions}
    >
      {children}
    </StudyShell>
  );

  if (cards.length === 0) {
    return shell(
      <EmptyState
        icon={Layers}
        title={t('noCardsTitle')}
        description={t('noCardsBody')}
        action={
          <Button asChild className="h-11 rounded-full px-5">
            <Link href={`/flashcards/${set.id}/edit`}>{t('addCards')}</Link>
          </Button>
        }
        className="my-auto"
      />,
    );
  }

  if (finished) {
    return shell(
      <section className="my-auto flex flex-col items-center gap-4 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <PartyPopper className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">
          {t('flipDone', {count: cards.length})}
        </h1>
        <p className="max-w-sm text-muted-foreground">{t('flipDoneBody')}</p>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Button asChild size="lg" className="h-12 rounded-full">
            <Link href={`/flashcards/${set.id}/study/learn`}>{t('toLearn')}</Link>
          </Button>
          <Button variant="outline" className="h-11 rounded-full" onClick={() => restart()} autoFocus>
            {t('again')}
          </Button>
          <Button asChild variant="ghost" className="h-11 rounded-full">
            <Link href={`/flashcards/${set.id}`}>{t('backToSet')}</Link>
          </Button>
        </div>
      </section>,
    );
  }

  const current = cards[order[index]];
  return shell(
    <div className="my-auto flex flex-col items-center gap-6">
      <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
        {t('position', {n: index + 1, total: cards.length})}
      </p>
      <button
        ref={cardButton}
        type="button"
        onClick={() => setFlipped(f => !f)}
        aria-label={flipped ? t('flipToFront') : t('flipToBack')}
        className="w-full rounded-[20px] [perspective:1200px]"
      >
        <span
          className={cn(
            'relative block aspect-[4/3] w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none sm:aspect-[16/9]',
            flipped && '[transform:rotateY(180deg)]',
          )}
        >
          <span className={cn(face, 'bg-card')} aria-hidden={flipped}>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {t('term')}
            </span>
            <span className="text-3xl font-bold break-words sm:text-5xl">{current.term}</span>
          </span>
          <span
            className={cn(face, 'border-primary/40 bg-secondary [transform:rotateY(180deg)]')}
            aria-hidden={!flipped}
          >
            <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-semibold text-primary">
              {t('definition')}
            </span>
            <span className="text-2xl font-bold break-words sm:text-3xl">{current.definition}</span>
            {current.example && (
              <span className="max-w-lg font-serif break-words text-muted-foreground italic">“{current.example}”</span>
            )}
          </span>
        </span>
      </button>
      <p className="text-center text-[13px] text-muted-foreground">
        {t.rich('flipHelp', {kbd: chunks => <kbd className={kbd}>{chunks}</kbd>})}
      </p>
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="size-12 rounded-full"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label={t('previous')}
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Button>
        <span className="w-28 text-center text-[13px] text-muted-foreground" aria-hidden="true">
          <kbd className={kbd}>←</kbd> <kbd className={kbd}>→</kbd>
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-12 rounded-full"
          onClick={() => go(1)}
          aria-label={t('next')}
        >
          <ArrowRight className="size-5" aria-hidden="true" />
        </Button>
      </div>
    </div>,
    <div className="h-1 bg-muted">
      <div className="h-full bg-primary transition-[width]" style={{width: `${((index + 1) / cards.length) * 100}%`}} />
    </div>,
    <Button
      variant="ghost"
      size="icon"
      className="size-11"
      aria-label={t('shuffle')}
      aria-pressed={shuffle}
      onClick={() => {
        setShuffle(!shuffle);
        restart(!shuffle);
      }}
    >
      <Shuffle className="size-5" aria-hidden="true" />
    </Button>,
  );
}
