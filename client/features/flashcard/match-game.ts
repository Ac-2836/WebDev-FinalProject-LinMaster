import {QUIZ_MIN_CARDS} from '@linmaster/shared';
import type {FlashcardCard} from '@linmaster/shared';

export const MATCH_PAIRS = 6;
/** Seconds added to the time for every wrong pair. */
export const MATCH_PENALTY_SECONDS = 1;
/** Match needs enough cards for a board that is not trivial. */
export const MATCH_MIN_CARDS = QUIZ_MIN_CARDS;

export interface Tile {
  key: string;
  cardId: string;
  side: 'term' | 'definition';
  text: string;
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A shuffled board: a term tile and a definition tile for each of up to `pairs` random cards. */
export function buildTiles(cards: readonly FlashcardCard[], random = Math.random, pairs = MATCH_PAIRS): Tile[] {
  const picked = shuffle(cards, random).slice(0, pairs);
  return shuffle(
    picked.flatMap(c => [
      {key: `${c.id}:term`, cardId: c.id, side: 'term' as const, text: c.term},
      {key: `${c.id}:definition`, cardId: c.id, side: 'definition' as const, text: c.definition},
    ]),
    random,
  );
}

/** Two tiles are a pair when they belong to the same card and are its two different sides. */
export const isPair = (a: Tile, b: Tile) => a.cardId === b.cardId && a.side !== b.side;

/** Total time shown: seconds played plus the penalty for each mistake. */
export const matchSeconds = (playedMs: number, mistakes: number) => playedMs / 1000 + mistakes * MATCH_PENALTY_SECONDS;

const bestKey = (setId: string) => `lm-match-best-${setId}`;

/** Best time for a set on this device (a convenience, so storage errors are ignored). */
export function readBest(setId: string): number | null {
  try {
    const value = Number(localStorage.getItem(bestKey(setId)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeBest(setId: string, seconds: number) {
  try {
    localStorage.setItem(bestKey(setId), String(seconds));
  } catch {
    // Private mode or blocked storage: the record is just not kept.
  }
}
