import {describe, expect, it} from 'vitest';

import {MAX_IMPORT_TEXT_CHARS, MAX_IMPORT_TEXT_PAGE_CHARS, MAX_IMPORT_TEXT_PAGES} from '@linmaster/shared';
import {ocrPages, ocrPercent, textPages} from './ocr-logic';

describe('ocrPages', () => {
  it('reads the pages in order, one at a time, and reports each page before reading it', async () => {
    const log: string[] = [];
    let running = 0;
    const texts = await ocrPages(
      3,
      async page => {
        running++;
        expect(running).toBe(1);
        await Promise.resolve();
        log.push(`read ${page}`);
        running--;
        return `text ${page}`;
      },
      p => log.push(`on ${p.page}/${p.pages}`),
    );
    expect(texts).toEqual(['text 1', 'text 2', 'text 3']);
    expect(log).toEqual(['on 1/3', 'read 1', 'on 2/3', 'read 2', 'on 3/3', 'read 3']);
  });

  it('stops when it is aborted, keeping nothing half done', async () => {
    const abort = new AbortController();
    await expect(
      ocrPages(
        5,
        async page => {
          if (page === 2) abort.abort();
          return `text ${page}`;
        },
        () => undefined,
        abort.signal,
      ),
    ).rejects.toThrow();
  });

  it('returns no text for a PDF with no pages', async () => {
    expect(
      await ocrPages(
        0,
        async () => 'x',
        () => undefined,
      ),
    ).toEqual([]);
  });
});

describe('ocrPercent', () => {
  it('counts the pages already read', () => {
    expect(ocrPercent({page: 1, pages: 13})).toBe(0);
    expect(ocrPercent({page: 8, pages: 13})).toBe(54);
    expect(ocrPercent({page: 1, pages: 0})).toBe(0);
    expect(ocrPercent({page: 0, pages: 13})).toBe(0);
  });
});

describe('textPages', () => {
  it('numbers the pages from 1 and keeps an empty page as an empty string', () => {
    expect(textPages(['one', '', 'three'])).toEqual([
      {page: 1, text: 'one'},
      {page: 2, text: ''},
      {page: 3, text: 'three'},
    ]);
  });

  it('cuts a page, the whole text and the page count to what the API accepts', () => {
    const long = 'x'.repeat(MAX_IMPORT_TEXT_PAGE_CHARS + 500);
    expect(textPages([long])[0].text).toHaveLength(MAX_IMPORT_TEXT_PAGE_CHARS);
    const many = textPages(Array.from({length: MAX_IMPORT_TEXT_PAGES + 20}, () => long));
    expect(many).toHaveLength(MAX_IMPORT_TEXT_PAGES);
    expect(many.reduce((n, p) => n + p.text.length, 0)).toBeLessThanOrEqual(MAX_IMPORT_TEXT_CHARS);
  });
});
