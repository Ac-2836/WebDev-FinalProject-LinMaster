import type {FlashcardCard} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {changes, invalidKeys, move, newRow, rowsFromCards, toCards} from './editor-rows';

const card = (id: string, position: number, term: string): FlashcardCard => ({
  id,
  term,
  definition: `${term} (vi)`,
  example: null,
  vocabEntryId: null,
  position,
  createdAt: '2026-11-11T00:00:00.000Z',
  updatedAt: '2026-11-11T00:00:00.000Z',
});

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const original = [card(b, 1, 'beta'), card(a, 0, 'alpha')];

describe('rowsFromCards', () => {
  it('orders rows by card position', () => {
    expect(rowsFromCards(original).map(r => r.term)).toEqual(['alpha', 'beta']);
  });
});

describe('move', () => {
  it('moves a row and ignores moves past the ends', () => {
    const rows = rowsFromCards(original);
    expect(move(rows, 0, 1).map(r => r.term)).toEqual(['beta', 'alpha']);
    expect(move(rows, 0, -1)).toBe(rows);
    expect(move(rows, 1, 2)).toBe(rows);
  });
});

describe('invalidKeys and toCards', () => {
  it('flags half-filled rows and drops blank ones', () => {
    const half = {...newRow(), term: 'gamma'};
    const blank = newRow();
    const rows = [...rowsFromCards(original), half, blank];
    expect([...invalidKeys(rows)]).toEqual([half.key]);
    expect(toCards([...rowsFromCards(original), blank])).toEqual([
      {id: a, term: 'alpha', definition: 'alpha (vi)', example: null, vocabEntryId: null},
      {id: b, term: 'beta', definition: 'beta (vi)', example: null, vocabEntryId: null},
    ]);
  });

  it('sends new rows without an id', () => {
    expect(toCards([{...newRow(), term: ' new ', definition: 'mới', example: ' '}])).toEqual([
      {term: 'new', definition: 'mới', example: null, vocabEntryId: null},
    ]);
  });
});

describe('changes', () => {
  it('counts added, edited, removed and reordered cards', () => {
    const [alpha, beta] = rowsFromCards(original);
    expect(changes(original, [alpha, beta])).toEqual({added: 0, edited: 0, removed: 0, reordered: false});
    const added = {...newRow(), term: 'gamma', definition: 'g'};
    expect(changes(original, [{...beta, term: 'BETA'}, alpha, added])).toEqual({
      added: 1,
      edited: 1,
      removed: 0,
      reordered: true,
    });
    expect(changes(original, [alpha])).toEqual({added: 0, edited: 0, removed: 1, reordered: false});
  });
});
