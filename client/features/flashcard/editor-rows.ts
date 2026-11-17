import {MAX_CARDS_PER_SET, type FlashcardCard, type ReplaceFlashcardCardInput} from '@linmaster/shared';

/** One editor row. `key` is local; `id` is set for cards that already exist (their SM-2 progress is kept). */
export interface Row {
  key: string;
  id?: string;
  term: string;
  definition: string;
  example: string;
  vocabEntryId: string | null;
}

let next = 0;
export const newRow = (): Row => ({key: `new-${next++}`, term: '', definition: '', example: '', vocabEntryId: null});

export const rowsFromCards = (cards: FlashcardCard[]): Row[] =>
  [...cards]
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      key: c.id,
      id: c.id,
      term: c.term,
      definition: c.definition,
      example: c.example ?? '',
      vocabEntryId: c.vocabEntryId,
    }));

const blank = (r: Row) => !r.term.trim() && !r.definition.trim() && !r.example.trim();

/** Moves one row; out-of-range targets leave the list unchanged. */
export function move(rows: Row[], from: number, to: number): Row[] {
  if (to < 0 || to >= rows.length || from === to) return rows;
  const copy = [...rows];
  const [row] = copy.splice(from, 1);
  copy.splice(to, 0, row);
  return copy;
}

/** Keys of rows that have some text but miss a term or a definition. Fully blank rows are simply dropped. */
export const invalidKeys = (rows: Row[]) =>
  new Set(rows.filter(r => !blank(r) && (!r.term.trim() || !r.definition.trim())).map(r => r.key));

/** Body of `PUT /flashcards/sets/:id/cards`: the whole list in order. */
export const toCards = (rows: Row[]): ReplaceFlashcardCardInput[] =>
  rows
    .filter(r => !blank(r))
    .map(r => ({
      ...(r.id && {id: r.id}),
      term: r.term.trim(),
      definition: r.definition.trim(),
      example: r.example.trim() || null,
      vocabEntryId: r.vocabEntryId,
    }));

/** What saving will do, for the save bar. Removed cards lose their study progress. */
export function changes(original: FlashcardCard[], rows: Row[]) {
  const kept = rows.filter(r => !blank(r));
  const byId = new Map(original.map(c => [c.id, c]));
  const keptIds = new Set(kept.flatMap(r => (r.id ? [r.id] : [])));
  const edited = kept.filter(r => {
    const c = r.id && byId.get(r.id);
    return (
      c && (c.term !== r.term.trim() || c.definition !== r.definition.trim() || (c.example ?? '') !== r.example.trim())
    );
  }).length;
  const order = kept.flatMap(r => (r.id ? [r.id] : []));
  const originalOrder = rowsFromCards(original)
    .map(r => r.id!)
    .filter(id => keptIds.has(id));
  return {
    added: kept.filter(r => !r.id).length,
    edited,
    removed: original.filter(c => !keptIds.has(c.id)).length,
    reordered: order.some((id, i) => id !== originalOrder[i]),
  };
}

/** Rows after pasting cards: fully blank rows are dropped, the pasted cards follow, and the set stays within the limit. */
export function appendPasted(
  rows: Row[],
  pasted: {term: string; definition: string}[],
): {rows: Row[]; added: number; dropped: number} {
  const kept = rows.filter(r => !blank(r));
  const room = Math.max(0, MAX_CARDS_PER_SET - kept.length);
  const added = pasted.slice(0, room);
  return {
    rows: [...kept, ...added.map(c => ({...newRow(), term: c.term, definition: c.definition}))],
    added: added.length,
    dropped: pasted.length - added.length,
  };
}
