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
