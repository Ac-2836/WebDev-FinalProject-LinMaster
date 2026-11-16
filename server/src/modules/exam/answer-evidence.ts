import type {AnswerEvidence} from '@linmaster/shared';

const MIN_QUOTE_LENGTH = 3;

export interface QuoteLocation {
  paragraph: number;
  start: number;
  end: number;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A word of the quote as a pattern that also accepts the other kind of apostrophe or quotation mark. */
const tokenPattern = (token: string) => escape(token).replace(/['’‘]/g, "['’‘]").replace(/["“”]/g, '["“”]');

/**
 * Where `quote` really is in the passage: the hinted paragraph first, then the others. Ignores case, the kind of
 * quotation mark and the amount of whitespace, so a model that re-wraps a line still counts; an invented quote
 * (or one under 3 characters, which would match anywhere) returns null.
 */
export function locateQuote(paragraphs: {text: string}[], hint: number, quote: string): QuoteLocation | null {
  const tokens = quote.trim().split(/\s+/u).filter(Boolean);
  if (tokens.join(' ').length < MIN_QUOTE_LENGTH) return null;
  const pattern = new RegExp(tokens.map(tokenPattern).join('\\s+'), 'iu');
  const order = [hint, ...paragraphs.map((_, index) => index).filter(index => index !== hint)];
  for (const paragraph of order) {
    const text = paragraphs[paragraph]?.text;
    const match = text === undefined ? null : pattern.exec(text);
    if (match) return {paragraph, start: match.index, end: match.index + match[0].length};
  }
  return null;
}

/** Evidence the passage really contains, as the passage writes it; unknown or repeated quotes are dropped. */
export function verifiedEvidence(
  passageId: string,
  paragraphs: {text: string}[],
  evidence: {paragraph: number; quote: string}[],
): AnswerEvidence[] {
  const seen = new Set<string>();
  return evidence.flatMap(({paragraph, quote}) => {
    const found = locateQuote(paragraphs, paragraph, quote);
    if (!found) return [];
    const key = `${found.paragraph}:${found.start}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{passageId, ...found, quote: paragraphs[found.paragraph]!.text.slice(found.start, found.end)}];
  });
}
