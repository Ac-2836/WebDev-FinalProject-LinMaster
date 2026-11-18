import {
  MAX_IMPORT_TEXT_CHARS,
  MAX_IMPORT_TEXT_PAGE_CHARS,
  MAX_IMPORT_TEXT_PAGES,
  type ImportFileTextRequest,
} from '@linmaster/shared';

export interface OcrProgress {
  /** The page being read, from 1; 0 while the reader is still being loaded. */
  page: number;
  pages: number;
}

/** What the progress bar shows: pages already read, out of all pages. */
export const ocrPercent = ({page, pages}: OcrProgress) =>
  pages > 0 ? Math.round((Math.max(page - 1, 0) / pages) * 100) : 0;

/**
 * Reads the pages one after the other (never two at once: a page image is big, and a phone has little memory) and
 * says which page it is on. `read(n)` renders page n and returns its text, freeing the image before it returns.
 */
export async function ocrPages(
  pages: number,
  read: (page: number) => Promise<string>,
  onProgress: (progress: OcrProgress) => void,
  signal?: AbortSignal,
): Promise<string[]> {
  const texts: string[] = [];
  for (let page = 1; page <= pages; page++) {
    signal?.throwIfAborted();
    onProgress({page, pages});
    texts.push(await read(page));
  }
  return texts;
}

/**
 * The OCR text as `PUT /tests/imports/files/:fileId/text` takes it: page numbers from 1, an empty string for a page
 * with no text, and cut to the limits of the API (pages, characters per page, characters in all) so the request is
 * never refused for size. Only a very long PDF loses text, from its last pages.
 */
export function textPages(texts: readonly string[]): ImportFileTextRequest['pages'] {
  let total = 0;
  return texts.slice(0, MAX_IMPORT_TEXT_PAGES).map((text, i) => {
    const kept = text.slice(0, Math.min(MAX_IMPORT_TEXT_PAGE_CHARS, MAX_IMPORT_TEXT_CHARS - total));
    total += kept.length;
    return {page: i + 1, text: kept};
  });
}
