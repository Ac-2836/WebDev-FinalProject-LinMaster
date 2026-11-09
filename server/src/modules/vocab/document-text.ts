import {AppError} from '../../core/app-error';

export const MAX_DOCUMENT_WORDS = 20_000;

export interface NormalizedDocumentText {
  paragraphs: Array<{text: string}>;
  wordCount: number;
}

export function normalizeDocumentText(rawText: string): NormalizedDocumentText {
  const paragraphs = rawText
    .normalize('NFKC')
    .split(String.fromCharCode(0))
    .join('')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/u)
    .map(text => text.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
  const wordCount = paragraphs.join(' ').split(/\s+/u).filter(Boolean).length;

  if (wordCount === 0) throw new AppError('No readable text was found in the document.', 422);
  if (wordCount > MAX_DOCUMENT_WORDS) throw new AppError('A document may contain at most 20,000 words.', 413);

  return {paragraphs: paragraphs.map(text => ({text})), wordCount};
}
