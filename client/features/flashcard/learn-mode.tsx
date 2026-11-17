'use client';

import {
  GetStudyCardsResponseSchema,
  ReviewCardResponseSchema,
  type CardState,
  type FlashcardSet,
  type Rating,
} from '@linmaster/shared';
import {CalendarCheck, CircleAlert, CloudOff, RotateCw, Trophy} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useCallback, useEffect, useRef, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {type LearnQueue, rate, RATING_KEYS, startQueue} from './learn-queue';
import {SpeakButton, speak} from './speak-button';
import {StudyShell} from './study-shell';
import {useStudyKeys, useStudySession} from './study-session';

const RATINGS: {rating: Rating; key: string; className: string}[] = [
  {
    rating: 'again',
    key: '1',
    className: 'border-destructive/40 bg-danger-soft text-destructive hover:border-destructive',
  },
  {rating: 'hard', key: '2', className: 'border-warning/40 bg-warning-soft text-warning hover:border-warning'},
  {rating: 'good', key: '3', className: 'border-success/40 bg-success-soft text-success hover:border-success'},
  {rating: 'easy', key: '4', className: 'border-primary/40 bg-secondary text-primary hover:border-primary'},
];
const STATE_STYLE: Record<CardState, string> = {
  new: 'bg-secondary text-primary',
  learning: 'bg-warning-soft text-warning',
  mastered: 'bg-success-soft text-success',
};
const kbd = 'rounded border bg-card px-1.5 font-mono text-xs';

/** Học (C3, wireframe 04-flashcard/study-learn): Space shows the answer, 1–4 rate; SM-2 runs on the server. */
export function LearnMode({set}: {set: FlashcardSet}) {
  const t = useTranslations('flashcard.study');
  const errorMessage = useErrorMessage();
  const [learn, setLearn] = useState<LearnQueue | null>(null);
  const [total, setTotal] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [pending, setPending] = useState<Rating | null>(null);
  const [reviewError, setReviewError] = useState<{rating: Rating; message: string} | null>(null);
  const startedAt = useRef(Date.now());
  const focusTarget = useRef<HTMLButtonElement>(null);
  const summaryLink = useRef<HTMLAnchorElement>(null);
  const session = useStudySession(set.id, 'learn', Boolean(learn && learn.queue.length));

  const load = useCallback(() => {
    setLoadFailed(false);
    setLearn(null);
    api(`/flashcards/sets/${set.id}/study`)
      .then(res => {
        const {cards} = GetStudyCardsResponseSchema.parse(res);
        setTotal(cards.length);
        setLearn(startQueue(cards));
        startedAt.current = Date.now();
      })
      .catch(() => setLoadFailed(true));
  }, [set.id]);
  useEffect(load, [load]);

  const card = learn?.queue[0];
  const finished = Boolean(learn && total > 0 && !card);

  // Keep keyboard focus on the main action as the card changes.
  useEffect(() => {
    focusTarget.current?.focus();
  }, [card?.id, showAnswer, finished]);

  useEffect(() => {
    if (!finished) return;
    summaryLink.current?.focus();
    void session.end();
  }, [finished, session]);

  async function submit(rating: Rating) {
    if (!card || pending) return;
    setPending(rating);
    setReviewError(null);
    try {
      const sessionId = await session.sessionId();
      ReviewCardResponseSchema.parse(
        await api('/flashcards/reviews', {
          method: 'POST',
          body: {cardId: card.id, rating, ...(sessionId && {sessionId})},
        }),
      );
      setLearn(q => q && rate(q, rating));
      setShowAnswer(false);
    } catch (err) {
      setReviewError({rating, message: errorMessage(err)});
    }
    setPending(null);
  }

  useStudyKeys((key, e) => {
    if (!card) return;
    if (key === 's' || key === 'S') speak(card.term);
    else if (!showAnswer && (key === ' ' || key === 'Enter')) {
      e.preventDefault();
      setShowAnswer(true);
    } else if (showAnswer && RATING_KEYS[key]) {
      e.preventDefault();
      void submit(RATING_KEYS[key]);
    }
  });

  const remaining = (state: CardState) => learn?.queue.filter(c => c.state === state).length ?? 0;
  const done = learn?.done ?? 0;
  const progress = learn && total > 0 && !finished && (
    <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 pb-3 text-xs font-semibold">
      <span className="text-primary">{t('countNew', {count: remaining('new')})}</span>
      <span className="text-warning">{t('countLearning', {count: remaining('learning')})}</span>
      <span className="text-success">{t('countReview', {count: remaining('mastered')})}</span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={t('progress', {done, total})}
      >
        <div className="h-full bg-primary transition-[width]" style={{width: `${(done / total) * 100}%`}} />
      </div>
      <span className="text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <StudyShell
      setId={set.id}
      title={set.title}
      modeLabel={t('learnLabel')}
      exitLabel={t('exitLearn')}
      onExit={() => session.end()}
      progress={progress}
    >
      {children}
    </StudyShell>
  );

  if (loadFailed) {
    return shell(
      <div role="alert" className="my-auto flex flex-col items-center gap-3 text-center">
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

  if (!learn) {
    return shell(
      <div className="flex flex-1 flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
        <Skeleton className="min-h-72 flex-1 rounded-[20px]" />
        <Skeleton className="mx-auto h-12 w-72 rounded-full" />
      </div>,
    );
  }

  if (total === 0) {
    return shell(
      <section className="my-auto flex flex-col items-center gap-4 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-3xl bg-secondary text-primary">
          <CalendarCheck className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">{t('emptyTitle')}</h1>
        <p className="max-w-sm text-muted-foreground">{t('emptyBody')}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="h-11 rounded-full px-5">
            <Link href={`/flashcards/${set.id}/study/flip`}>{t('toFlip')}</Link>
          </Button>
          <Button asChild variant="ghost" className="h-11 rounded-full px-5">
            <Link href={`/flashcards/${set.id}`}>{t('backToSet')}</Link>
          </Button>
        </div>
      </section>,
    );
  }

  if (finished) {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    return shell(
      <section className="my-auto flex flex-col items-center gap-6 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <Trophy className="size-8" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">{t('summaryTitle')}</h1>
          <p className="mt-1 text-muted-foreground">{t('summaryBody', {count: total, minutes})}</p>
        </div>
        <dl className="grid w-full max-w-md grid-cols-4 gap-2">
          {RATINGS.map(({rating, className}) => (
            <div key={rating} className="flex flex-col-reverse rounded-[20px] border bg-card p-3 shadow-soft">
              <dt className="text-[13px] text-muted-foreground">{t(`rating.${rating}`)}</dt>
              <dd
                className={cn(
                  'text-xl font-bold',
                  className.split(' ').find(c => c.startsWith('text-')),
                )}
              >
                {learn.tally[rating]}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Button asChild size="lg" className="h-12 rounded-full">
            <Link href={`/flashcards/${set.id}`} ref={summaryLink}>
              {t('backToSet')}
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-full">
            <Link href={`/flashcards/${set.id}/study/flip`}>{t('toFlip')}</Link>
          </Button>
        </div>
      </section>,
    );
  }

  return shell(
    <>
      <div className="relative flex min-h-72 flex-1 flex-col items-center justify-center gap-4 rounded-[20px] border bg-card p-6 text-center shadow-lg sm:min-h-80 sm:p-8">
        <div className="absolute top-3 right-3">
          <SpeakButton text={card!.term} />
        </div>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATE_STYLE[card!.state])}>
          {t(`state.${card!.state}`)}
        </span>
        <p className="text-3xl font-bold [overflow-wrap:anywhere] sm:text-5xl">{card!.term}</p>
        {showAnswer && (
          <div className="flex w-full flex-col items-center gap-3 border-t pt-5" aria-live="polite">
            <p className="text-2xl font-bold [overflow-wrap:anywhere]">{card!.definition}</p>
            {card!.example && (
              <p className="max-w-lg font-serif [overflow-wrap:anywhere] text-muted-foreground italic">
                “{card!.example}”
              </p>
            )}
          </div>
        )}
      </div>

      {reviewError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-center gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          <span>{t('reviewError', {reason: reviewError.message})}</span>
          <Button variant="outline" className="h-9 rounded-full" onClick={() => void submit(reviewError.rating)}>
            {t('retry')}
          </Button>
        </div>
      )}

      {!showAnswer ? (
        <div className="flex flex-col items-center gap-2">
          <Button
            ref={focusTarget}
            size="lg"
            className="h-12 w-full rounded-full sm:w-72"
            onClick={() => setShowAnswer(true)}
          >
            {t('showAnswer')}
          </Button>
          <p className="text-[13px] text-muted-foreground">
            {t.rich('showAnswerHelp', {kbd: chunks => <kbd className={kbd}>{chunks}</kbd>})}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-center text-sm font-semibold" id="rate-label">
            {t('rateQuestion')}
          </p>
          <div className="grid grid-cols-4 gap-2" role="group" aria-labelledby="rate-label">
            {RATINGS.map(({rating, key, className}, i) => (
              <button
                key={rating}
                ref={i === 2 ? focusTarget : undefined}
                type="button"
                onClick={() => void submit(rating)}
                disabled={pending !== null}
                aria-keyshortcuts={key}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border-2 font-bold disabled:opacity-60',
                  className,
                )}
              >
                {t(`rating.${rating}`)}
                <kbd className="font-mono text-[11px] font-normal opacity-70">{key}</kbd>
              </button>
            ))}
          </div>
          <p className="text-center text-[13px] text-muted-foreground">{t('rateHelp')}</p>
        </div>
      )}
    </>,
  );
}
