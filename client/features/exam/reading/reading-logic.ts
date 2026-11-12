import {countWords, normalizeText, type GivenAnswer, type QuestionKind} from '@linmaster/shared';

/** Answers by question number (the room maps them to the question ids of `Attempt.state.answers`). */
export type Answers = Readonly<Record<number, GivenAnswer | undefined>>;

export const isAnswered = (given: GivenAnswer | undefined) => typeof given === 'string' && given.trim() !== '';

/** True when a typed answer has more words than "NO MORE THAN N WORDS" allows (numbers do not count). */
export const overWordLimit = (given: GivenAnswer | undefined, wordLimit?: number | null) =>
  !!wordLimit && isAnswered(given) && countWords(normalizeText(given!)) > wordLimit;

export const JUDGEMENTS: Partial<Record<QuestionKind, readonly string[]>> = {
  tfng: ['TRUE', 'FALSE', 'NOT GIVEN'],
  ynng: ['YES', 'NO', 'NOT GIVEN'],
};

/**
 * "Choose TWO letters": the letters ticked for the group, read from the answers of its questions.
 */
export const multiChoiceSelected = (numbers: readonly number[], answers: Answers) =>
  numbers.map(n => answers[n]).filter((v): v is string => isAnswered(v));

/**
 * Ticking or unticking a letter in a "Choose N letters" group. Letters are stored one per question,
 * in alphabetical order (grading accepts any order). Returns null when N letters are already ticked.
 */
export function toggleMultiChoice(
  numbers: readonly number[],
  answers: Answers,
  key: string,
): Record<number, string | null> | null {
  const selected = multiChoiceSelected(numbers, answers);
  const next = selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key];
  if (next.length > numbers.length) return null;
  next.sort();
  return Object.fromEntries(numbers.map((n, i) => [n, next[i] ?? null]));
}

/** Splits a prompt around its `{{blank}}`. */
export function splitBlank(prompt: string): [string, string] | null {
  const i = prompt.indexOf('{{blank}}');
  return i === -1 ? null : [prompt.slice(0, i), prompt.slice(i + '{{blank}}'.length)];
}

/** Cuts group text (notes, table cells) at its `{{n}}` gaps: strings stay, gaps become question numbers. */
export const splitGaps = (text: string): (string | number)[] =>
  text
    .split(/\{\{(\d+)\}\}/)
    .map((part, i) => (i % 2 ? Number(part) : part))
    .filter(part => part !== '');

// --- Highlights and notes on the passage ---

/** A highlighted range in one paragraph (character offsets in its text), saved in `Attempt.state.highlights`. */
export interface Highlight {
  paragraph: number;
  start: number;
  end: number;
  note?: string;
}

export interface TextRange {
  paragraph: number;
  start: number;
  end: number;
}

const overlaps = (h: TextRange, r: TextRange) => h.paragraph === r.paragraph && h.start < r.end && r.start < h.end;

const byPosition = (a: TextRange, b: TextRange) => a.paragraph - b.paragraph || a.start - b.start;

/** Adds highlights; overlapping or touching ones in the same paragraph merge, keeping their notes. */
export function addHighlights(list: readonly Highlight[], ranges: readonly TextRange[]): Highlight[] {
  let result = [...list];
  for (const range of ranges) {
    if (range.end <= range.start) continue;
    let merged: Highlight = {...range};
    const notes: string[] = [];
    result = result.filter(h => {
      const touches = h.paragraph === range.paragraph && h.start <= merged.end && merged.start <= h.end;
      if (!touches) return true;
      merged = {...merged, start: Math.min(merged.start, h.start), end: Math.max(merged.end, h.end)};
      if (h.note) notes.push(h.note);
      return false;
    });
    if (notes.length) merged.note = notes.join('\n');
    result.push(merged);
  }
  return result.sort(byPosition);
}

/** "Clear": removes every highlight touching one of the ranges. */
export const clearHighlights = (list: readonly Highlight[], ranges: readonly TextRange[]) =>
  list.filter(h => !ranges.some(r => overlaps(h, r)));

/** Sets or removes (empty text) the note of the highlight at `index`. */
export function setNote(list: readonly Highlight[], index: number, note: string): Highlight[] {
  return list.map((h, i) => {
    if (i !== index) return h;
    const rest = {...h};
    delete rest.note;
    return note.trim() ? {...rest, note} : rest;
  });
}

export interface Segment {
  text: string;
  /** Index in the highlight list, or -1 for plain text. */
  highlight: number;
}

/** Cuts one paragraph into plain and highlighted pieces for rendering. */
export function segments(text: string, paragraph: number, list: readonly Highlight[]): Segment[] {
  const marks = list
    .map((h, index) => ({...h, index}))
    .filter(h => h.paragraph === paragraph)
    .sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let pos = 0;
  for (const h of marks) {
    const start = Math.max(h.start, pos);
    const end = Math.min(h.end, text.length);
    if (end <= start) continue;
    if (start > pos) out.push({text: text.slice(pos, start), highlight: -1});
    out.push({text: text.slice(start, end), highlight: h.index});
    pos = end;
  }
  if (pos < text.length) out.push({text: text.slice(pos), highlight: -1});
  return out;
}

/** Strike-through on options ("cross out"), by question number, saved with the attempt state. */
export type Struck = Readonly<Record<number, readonly string[]>>;

export function toggleStruck(struck: Struck, question: number, key: string): Struck {
  const current = struck[question] ?? [];
  const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
  return {...struck, [question]: next};
}
