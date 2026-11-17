import type {FlashcardCard} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {buildTiles, isPair, matchSeconds, shuffle, type Tile} from './match-game';

const groupByCard = (tiles: Tile[]) =>
  Object.values(
    tiles.reduce<Record<string, Tile[]>>((acc, t) => ({...acc, [t.cardId]: [...(acc[t.cardId] ?? []), t]}), {}),
  );

const cards = (n: number): FlashcardCard[] =>
  Array.from({length: n}, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    term: `term ${i}`,
    definition: `definition ${i}`,
    example: null,
    vocabEntryId: null,
    position: i,
    createdAt: '2026-11-11T00:00:00.000Z',
    updatedAt: '2026-11-11T00:00:00.000Z',
  }));

describe('shuffle', () => {
  it('keeps every item and does not change the input', () => {
    const input = [1, 2, 3, 4, 5];
    expect(shuffle(input).sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('buildTiles', () => {
  it('makes a term and a definition tile for each of six cards', () => {
    const tiles = buildTiles(cards(10));
    expect(tiles).toHaveLength(12);
    const byCard = groupByCard(tiles);
    expect(byCard).toHaveLength(6);
    for (const pair of byCard) expect(pair.map(t => t.side).sort()).toEqual(['definition', 'term']);
  });

  it('uses every card when the set has fewer than six', () => {
    expect(buildTiles(cards(4))).toHaveLength(8);
  });
});

describe('isPair', () => {
  it('accepts the two sides of one card only', () => {
    const tiles = buildTiles(cards(2));
    const [first, second] = groupByCard(tiles);
    expect(isPair(first[0], first[1])).toBe(true);
    expect(isPair(first[0], first[0])).toBe(false);
    expect(isPair(first[0], second[0])).toBe(false);
  });
});

describe('matchSeconds', () => {
  it('adds one second per mistake', () => {
    expect(matchSeconds(20400, 3)).toBeCloseTo(23.4);
  });
});
