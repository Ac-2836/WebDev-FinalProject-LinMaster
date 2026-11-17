import {MAX_LOOKUP_WORDS} from '@linmaster/shared';

/** A range of the request's sentence (`end` is exclusive). */
export interface Range {
  start: number;
  end: number;
}

const WORD = /[\p{L}\p{N}'’-]+/gu;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Words that do not make a phrase on their own: dropping them from a selection loses no meaning.
const FUNCTION_WORDS = new Set(
  (
    'a an the of to in on at by for with from into as than and or but so if who whom whose which that what ' +
    'is are was were be been being am it its this these those can may will would should could shall might must ' +
    'has have had do does did not no their his her our your my they them he she we you i'
  ).split(' '),
);

/** Occurrences of `text` in `sentence`, ignoring case (overlapping ones included). */
function occurrencesOf(text: string, sentence: string): number[] {
  const starts: number[] = [];
  const haystack = sentence.toLowerCase();
  const needle = text.toLowerCase();
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) starts.push(at);
  return starts;
}

/**
 * Where the selected text sits in the sentence: at `textStart` when the client sent it, else its first occurrence.
 * `occurrence` (counted from 1) is set only when the text appears more than once, so the AI can be told which one.
 */
export function selectionRange(text: string, sentence: string, textStart?: number): Range & {occurrence?: number} {
  const starts = occurrencesOf(text, sentence);
  const start = textStart ?? starts[0] ?? 0;
  const index = starts.indexOf(start);
  return {start, end: start + text.length, occurrence: starts.length > 1 && index >= 0 ? index + 1 : undefined};
}

/**
 * Finds what the AI explained (`headword`) in the sentence: the same words in the same order, whole words only,
 * overlapping the selection and at most 6 words. Of several candidates the one sharing most with the selection wins.
 * The range comes from the sentence, never from the AI, so it always lies inside it.
 */
export function locatePhrase(headword: string, sentence: string, selection: Range): (Range & {text: string}) | null {
  const words = headword.match(WORD);
  if (!words || words.length > MAX_LOOKUP_WORDS) return null;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${words.map(escapeRegExp).join('\\s+')}(?![\\p{L}\\p{N}])`, 'giu');

  let best: (Range & {text: string; overlap: number}) | null = null;
  for (const found of sentence.matchAll(pattern)) {
    const start = found.index;
    const end = start + found[0].length;
    const overlap = Math.min(end, selection.end) - Math.max(start, selection.start);
    if (overlap > 0 && (!best || overlap > best.overlap)) best = {start, end, text: found[0], overlap};
  }
  return best && {start: best.start, end: best.end, text: best.text};
}

/**
 * True when a one-word answer threw away part of a longer selection that carried meaning: a leftover word that is
 * not a function word. ("the regression" -> "regression" is fine; "give frequent feedback" -> "give" is not.)
 */
export function droppedMeaning(selection: {start: number; text: string}, found: Range): boolean {
  const words = [...selection.text.matchAll(WORD)].map(word => {
    const start = selection.start + word.index;
    return {word: word[0], inside: start < found.end && start + word[0].length > found.start};
  });
  const kept = words.filter(({inside}) => inside).length;
  const lost = words.filter(({inside, word}) => !inside && !FUNCTION_WORDS.has(word.toLowerCase()));
  return words.length >= 2 && kept <= 1 && lost.length > 0;
}
