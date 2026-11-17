'use client';

import type {FlashcardSet} from '@linmaster/shared';
import {Layers, Timer} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useCallback, useEffect, useRef, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';

import {
  buildTiles,
  isPair,
  MATCH_MIN_CARDS,
  MATCH_PENALTY_SECONDS,
  matchSeconds,
  readBest,
  type Tile,
  writeBest,
} from './match-game';
import {StudyShell} from './study-shell';
import {useStudySession} from './study-session';

const WRONG_FLASH_MS = 450;
const seconds = (value: number) => `${value.toFixed(1)}s`;

/** Shared by the modes that need a few cards to make a board or a quiz. */
export function NeedMoreCards({set, modeLabel, min}: {set: FlashcardSet; modeLabel: string; min: number}) {
  const t = useTranslations('flashcard.study');
  return (
    <StudyShell setId={set.id} title={set.title} modeLabel={modeLabel}>
      <EmptyState
        icon={Layers}
        title={t('needCardsTitle', {min})}
        description={t('needCardsBody', {count: set.cards.length, min})}
        action={
          <Button asChild className="h-11 rounded-full px-5">
            <Link href={`/flashcards/${set.id}/edit`}>{t('addCards')}</Link>
          </Button>
        }
        className="my-auto"
      />
    </StudyShell>
  );
}

/**
 * Ghép thẻ (C3, wireframe 04-flashcard/study-match): six random pairs, pick a term then its definition. A wrong pair
 * costs one second. The tiles are buttons, so Tab and Enter work. Does not change SM-2 progress.
 */
export function MatchMode({set}: {set: FlashcardSet}) {
  const t = useTranslations('flashcard.study');
  if (set.cards.length < MATCH_MIN_CARDS) {
    return <NeedMoreCards set={set} modeLabel={t('match')} min={MATCH_MIN_CARDS} />;
  }
  return <Board set={set} />;
}

function Board({set}: {set: FlashcardSet}) {
  const t = useTranslations('flashcard.study');
  const [round, setRound] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>(() => buildTiles(set.cards));
  const [done, setDone] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Tile | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [played, setPlayed] = useState(0);
  const [result, setResult] = useState<{time: number; best: number | null; record: boolean} | null>(null);
  const [announce, setAnnounce] = useState('');
  const started = useRef(performance.now());
  const grid = useRef<HTMLDivElement>(null);
  const again = useRef<HTMLButtonElement>(null);
  const session = useStudySession(set.id, 'match', true);
  const pairs = tiles.length / 2;

  // Elapsed time while playing; the clock stops at the last pair.
  useEffect(() => {
    if (result) return;
    const id = setInterval(() => setPlayed(performance.now() - started.current), 100);
    return () => clearInterval(id);
  }, [result, round]);

  // A matched tile disappears, so keep the keyboard on the board: move focus to the first tile left.
  useEffect(() => {
    if (done.size > 0 && !result) grid.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
  }, [done, result]);

  useEffect(() => {
    if (result) again.current?.focus();
  }, [result]);

  const finish = useCallback(
    (matched: number, wrongCount: number) => {
      const time = matchSeconds(performance.now() - started.current, wrongCount);
      const previous = readBest(set.id);
      const record = previous === null || time < previous;
      if (record) writeBest(set.id, time);
      setResult({time, best: record ? time : previous, record});
      void session.end({cardsStudied: matched, correctCount: Math.max(0, matched - wrongCount)});
    },
    [session, set.id],
  );

  function pick(tile: Tile) {
    if (result || wrong.length > 0 || done.has(tile.cardId)) return;
    if (!selected || selected.side === tile.side) {
      setSelected(selected?.key === tile.key ? null : tile);
      return;
    }
    if (isPair(selected, tile)) {
      const next = new Set(done).add(tile.cardId);
      setDone(next);
      setSelected(null);
      setAnnounce(t('matchPaired', {done: next.size, total: pairs}));
      if (next.size === pairs) finish(pairs, mistakes);
    } else {
      setMistakes(m => m + 1);
      setWrong([selected.key, tile.key]);
      setSelected(null);
      setAnnounce(t('matchWrong'));
      setTimeout(() => setWrong([]), WRONG_FLASH_MS);
    }
  }

  function restart() {
    setTiles(buildTiles(set.cards));
    setDone(new Set());
    setSelected(null);
    setWrong([]);
    setMistakes(0);
    setPlayed(0);
    setResult(null);
    started.current = performance.now();
    setRound(r => r + 1);
  }

  const time = matchSeconds(played, mistakes);
  return (
    <StudyShell
      setId={set.id}
      title={set.title}
      modeLabel={t('match')}
      onExit={() =>
        result ? undefined : session.end({cardsStudied: done.size, correctCount: Math.max(0, done.size - mistakes)})
      }
      actions={
        !result && (
          <p
            className="w-16 text-right font-mono text-lg font-bold tabular-nums"
            aria-label={t('matchTime', {value: seconds(time)})}
          >
            {seconds(time)}
          </p>
        )
      }
    >
      <p className="sr-only" role="status">
        {announce}
      </p>
      {result ? (
        <section className="mx-auto my-auto flex max-w-sm flex-col items-center gap-5 py-6 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
            <Timer className="size-8" aria-hidden="true" />
          </span>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">
            {t('matchDone', {value: seconds(result.time)})}
          </h1>
          <p className="text-muted-foreground">
            {result.record
              ? t('matchRecord')
              : t.rich('matchBest', {value: seconds(result.best ?? 0), b: chunks => <strong>{chunks}</strong>})}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button ref={again} size="lg" className="h-12 rounded-full" onClick={restart}>
              {t('playAgain')}
            </Button>
            <Button asChild variant="ghost" className="h-11 rounded-full">
              <Link href={`/flashcards/${set.id}`}>{t('backToSet')}</Link>
            </Button>
          </div>
        </section>
      ) : (
        <>
          <p className="text-center text-sm text-muted-foreground">
            {t('matchStatus', {done: done.size, total: pairs, mistakes, penalty: mistakes * MATCH_PENALTY_SECONDS})}
          </p>
          <div ref={grid} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tiles.map(tile =>
              done.has(tile.cardId) ? (
                <div key={tile.key} className="min-h-24 rounded-xl" aria-hidden="true" />
              ) : (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => pick(tile)}
                  aria-pressed={selected?.key === tile.key}
                  className={cn(
                    'flex min-h-24 items-center justify-center rounded-xl border-2 bg-card p-3 text-center font-semibold break-words shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    tile.side === 'term' ? 'text-lg' : 'text-[15px]',
                    selected?.key === tile.key && 'border-primary bg-secondary text-primary',
                    wrong.includes(tile.key) &&
                      'animate-pulse border-destructive bg-danger-soft text-destructive motion-reduce:animate-none',
                    !selected?.key && !wrong.includes(tile.key) && 'hover:border-primary',
                  )}
                >
                  {tile.text}
                </button>
              ),
            )}
          </div>
          <p className="text-center text-[13px] text-muted-foreground">{t('matchHelp')}</p>
        </>
      )}
    </StudyShell>
  );
}
