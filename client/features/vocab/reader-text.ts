// Pure text helpers for the reader. Offsets are character positions in the whole document text:
// the paragraphs joined by PARAGRAPH_GAP. Saved contexts (startOffset/endOffset) use the same scale.

export const PARAGRAPH_GAP = '\n\n';

export interface Token {
  /** Paragraph index. */
  p: number;
  start: number;
  end: number;
}

export interface Paragraph {
  text: string;
  /** Offset of the paragraph's first character in the whole document. */
  start: number;
  tokens: Token[];
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** Splits the document into paragraphs and word tokens, all with document offsets. */
export function layoutDocument(texts: string[]): {paragraphs: Paragraph[]; tokens: Token[]} {
  const paragraphs: Paragraph[] = [];
  const tokens: Token[] = [];
  let start = 0;
  texts.forEach((text, p) => {
    const own = [...text.matchAll(WORD)].map(m => ({p, start: start + m.index, end: start + m.index + m[0].length}));
    paragraphs.push({text, start, tokens: own});
    tokens.push(...own);
    start += text.length + PARAGRAPH_GAP.length;
  });
  return {paragraphs, tokens};
}

/** Index of the token at or after `offset` (end of a selection uses the token at or before). */
export function tokenAt(tokens: Token[], offset: number, side: 'start' | 'end') {
  if (side === 'start') {
    const i = tokens.findIndex(t => t.end > offset);
    return i === -1 ? tokens.length - 1 : i;
  }
  for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i].start < offset) return i;
  return 0;
}

/**
 * The sentence around [start, end) inside one paragraph, used as the lookup context. `text` is trimmed (the server
 * trims too, so offsets agree); `start` is where it begins in the whole document.
 */
export function sentenceSpan(paragraph: Paragraph, start: number, end: number) {
  const from = start - paragraph.start;
  const to = end - paragraph.start;
  const text = paragraph.text;
  let s = 0;
  let e = text.length;
  for (const m of text.matchAll(/[.!?…]+["”’)\]]*\s+/gu)) {
    const boundary = m.index + m[0].length;
    if (boundary <= from) s = boundary;
    else if (m.index >= to) {
      e = m.index + m[0].trimEnd().length;
      break;
    }
  }
  const raw = text.slice(s, e);
  return {text: raw.trim(), start: paragraph.start + s + (raw.length - raw.trimStart().length)};
}

export const sentenceAround = (paragraph: Paragraph, start: number, end: number) =>
  sentenceSpan(paragraph, start, end).text;

/** Longest paragraph the lookup API accepts as context. */
export const MAX_CONTEXT_PARAGRAPH = 3000;

/** The paragraph for the lookup context, cut to the API limit around the sentence when it is longer. */
export function contextParagraph(paragraph: Paragraph, sentenceStart: number) {
  if (paragraph.text.length <= MAX_CONTEXT_PARAGRAPH) return paragraph.text;
  const from = Math.max(0, sentenceStart - paragraph.start - MAX_CONTEXT_PARAGRAPH / 2);
  return paragraph.text.slice(from, from + MAX_CONTEXT_PARAGRAPH);
}

export interface Segment {
  text: string;
  start: number;
  /** Index into the highlight list, or -1 for plain text. */
  mark: number;
}

/** Cuts a paragraph at highlight edges so each piece can be rendered plain or marked. Later ranges win on overlap. */
export function segmentParagraph(paragraph: Paragraph, ranges: {start: number; end: number}[]): Segment[] {
  const pEnd = paragraph.start + paragraph.text.length;
  const cuts = new Set([paragraph.start, pEnd]);
  for (const r of ranges) {
    if (r.end <= paragraph.start || r.start >= pEnd) continue;
    cuts.add(Math.max(r.start, paragraph.start));
    cuts.add(Math.min(r.end, pEnd));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    let mark = -1;
    ranges.forEach((r, k) => {
      if (r.start <= a && r.end >= b) mark = k;
    });
    segments.push({text: paragraph.text.slice(a - paragraph.start, b - paragraph.start), start: a, mark});
  }
  return segments;
}

/** Joins neighbouring segments of one mark, so the active selection is one frame even when saved words overlap it. */
export function mergeRuns(segments: Segment[], mark: number): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    const last = out.at(-1);
    if (s.mark === mark && last?.mark === mark) last.text += s.text;
    else out.push({...s});
  }
  return out;
}
