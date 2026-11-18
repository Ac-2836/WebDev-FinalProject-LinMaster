import {z} from 'zod';

/** What `StoredFile.pageText` holds: the OCR text of the pages of a PDF, sent by the browser. */
const StoredPageTextSchema = z.array(z.object({page: z.number().int().positive(), text: z.string()}));
export type StoredPageText = z.infer<typeof StoredPageTextSchema>;

/** The text stored for a file; an empty list when nothing (or something unreadable) is stored. */
export function readPageText(value: unknown): StoredPageText {
  const parsed = StoredPageTextSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Pages that have text, ascending. */
export const textPagesOf = (value: unknown): number[] =>
  readPageText(value)
    .map(entry => entry.page)
    .sort((a, b) => a - b);

/**
 * Text of several PDFs merged into one, in order: the pages of each PDF follow those of the PDFs before it, so its
 * page numbers move up by their page counts. A PDF without text leaves its pages without text; null when no page has any.
 */
export function mergePageText(parts: {pageCount: number; pageText: unknown}[]): StoredPageText | null {
  const merged: StoredPageText = [];
  let offset = 0;
  for (const {pageCount, pageText} of parts) {
    for (const {page, text} of readPageText(pageText)) if (page <= pageCount) merged.push({page: page + offset, text});
    offset += pageCount;
  }
  return merged.length > 0 ? merged : null;
}
