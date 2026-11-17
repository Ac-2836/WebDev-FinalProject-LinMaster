import {describe, expect, it} from 'vitest';

import {
  contextParagraph,
  layoutDocument,
  MAX_CONTEXT_PARAGRAPH,
  mergeRuns,
  segmentParagraph,
  sentenceAround,
  sentenceSpan,
  tokenAt,
} from './reader-text';

const doc = layoutDocument([
  'Governments are under pressure to mitigate the effects. Funding remains limited!',
  "Residents' compensation is low.",
]);

describe('layoutDocument', () => {
  it('gives every word a document offset across paragraphs', () => {
    const [first] = doc.paragraphs[1].tokens;
    expect(doc.paragraphs[1].start).toBe(doc.paragraphs[0].text.length + 2);
    // A trailing possessive apostrophe is punctuation, not part of the word.
    expect(
      doc.paragraphs[1].text.slice(first.start - doc.paragraphs[1].start, first.end - doc.paragraphs[1].start),
    ).toBe('Residents');
  });

  it('keeps apostrophes and hyphens inside a word', () => {
    expect(layoutDocument(["well-known don't"]).tokens).toHaveLength(2);
  });
});

describe('tokenAt', () => {
  it('snaps a selection to whole words', () => {
    const text = doc.paragraphs[0].text;
    const at = text.indexOf('itigate');
    const i = tokenAt(doc.tokens, at, 'start');
    const j = tokenAt(doc.tokens, at + 3, 'end');
    expect(text.slice(doc.tokens[i].start, doc.tokens[j].end)).toBe('mitigate');
  });
});

describe('sentenceAround', () => {
  it('returns only the sentence that holds the selection', () => {
    const p = doc.paragraphs[0];
    const start = p.text.indexOf('mitigate');
    expect(sentenceAround(p, start, start + 8)).toBe('Governments are under pressure to mitigate the effects.');
    const f = p.text.indexOf('Funding');
    expect(sentenceAround(p, f, f + 7)).toBe('Funding remains limited!');
  });

  it('says where the sentence starts in the document', () => {
    const second = doc.paragraphs[1];
    const at = second.start + second.text.indexOf('low');
    const span = sentenceSpan(second, at, at + 3);
    expect(span.start).toBe(second.start);
    const padded = layoutDocument(['One. Two words here.']).paragraphs[0];
    const w = padded.text.indexOf('words');
    const s = sentenceSpan(padded, w, w + 5);
    expect(padded.text.slice(s.start, s.start + s.text.length)).toBe('Two words here.');
  });
});

describe('contextParagraph', () => {
  it('keeps a short paragraph and cuts a long one to the API limit', () => {
    expect(contextParagraph(doc.paragraphs[0], 0)).toBe(doc.paragraphs[0].text);
    const long = layoutDocument(['word '.repeat(2000)]).paragraphs[0];
    expect(contextParagraph(long, 5000)).toHaveLength(MAX_CONTEXT_PARAGRAPH);
  });
});

describe('segmentParagraph', () => {
  it('splits text around highlights and keeps every character', () => {
    const p = doc.paragraphs[0];
    const start = p.text.indexOf('mitigate');
    const segments = segmentParagraph(p, [{start, end: start + 8}]);
    expect(segments.map(s => s.text).join('')).toBe(p.text);
    expect(segments.find(s => s.mark === 0)?.text).toBe('mitigate');
  });

  it('ignores highlights in other paragraphs', () => {
    expect(segmentParagraph(doc.paragraphs[1], [{start: 0, end: 5}])).toHaveLength(1);
  });
});

describe('mergeRuns', () => {
  it('keeps the selection in one piece when a saved word overlaps it', () => {
    const p = doc.paragraphs[0];
    const a = p.text.indexOf('under');
    const b = p.text.indexOf('mitigate');
    const saved = {start: b, end: b + 8};
    const active = {start: a, end: b + 14};
    const merged = mergeRuns(segmentParagraph(p, [saved, active]), 1);
    expect(merged.filter(s => s.mark === 1)).toHaveLength(1);
    expect(merged.find(s => s.mark === 1)?.text).toBe(p.text.slice(a, b + 14));
    expect(merged.map(s => s.text).join('')).toBe(p.text);
  });
});
