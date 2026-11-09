import {extname} from 'node:path';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import {AppError} from '../../core/app-error';

export const MAX_DOCUMENT_FILE_BYTES = 5 * 1024 * 1024;

export interface UploadedDocument {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

function detectDocumentType(file: UploadedDocument): 'pdf' | 'docx' | 'txt' {
  const extension = extname(file.originalName).toLowerCase();
  if (!['.pdf', '.docx', '.txt'].includes(extension)) {
    throw new AppError('Only PDF, DOCX, and TXT files are supported.', 415, undefined, 'INVALID_ARGUMENT');
  }

  if (extension === '.pdf') {
    if (!file.buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) {
      throw new AppError('The uploaded file is not a valid PDF.', 400);
    }
    return 'pdf';
  }
  if (extension === '.docx') {
    if (!file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      throw new AppError('The uploaded file is not a valid DOCX document.', 400);
    }
    return 'docx';
  }

  return 'txt';
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const loadingTask = getDocument({data: new Uint8Array(buffer), disableFontFace: true});
  const pdf = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: Array<{y: number; height: number; text: string}> = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = item.transform[5] ?? 0;
        const height = item.height || Math.abs(item.transform[3]) || 12;
        const currentLine = lines.at(-1);
        if (currentLine && Math.abs(currentLine.y - y) <= Math.max(1, height * 0.2)) {
          currentLine.text += `${currentLine.text.endsWith(' ') ? '' : ' '}${item.str}`;
          currentLine.height = Math.max(currentLine.height, height);
        } else {
          lines.push({y, height, text: item.str});
        }
      }

      const paragraphs: string[] = [];
      let paragraphLines: string[] = [];
      let previousLine: (typeof lines)[number] | undefined;
      for (const line of lines) {
        if (previousLine) {
          const verticalGap = Math.abs(previousLine.y - line.y);
          if (verticalGap > 1.5 * Math.max(previousLine.height, line.height)) {
            paragraphs.push(paragraphLines.join(' '));
            paragraphLines = [];
          }
        }
        paragraphLines.push(line.text.trim());
        previousLine = line;
      }
      if (paragraphLines.length > 0) paragraphs.push(paragraphLines.join(' '));
      pages.push(paragraphs.join('\n\n'));
      page.cleanup();
    }
    return pages.join('\n\n');
  } finally {
    await loadingTask.destroy();
  }
}

export async function extractDocumentText(file: UploadedDocument): Promise<string> {
  if (file.buffer.byteLength > MAX_DOCUMENT_FILE_BYTES) {
    throw new AppError('Document files must be 5 MB or smaller.', 413);
  }

  const type = detectDocumentType(file);
  try {
    if (type === 'pdf') return await extractPdfText(file.buffer);
    if (type === 'docx') {
      // shortcut: add an uncompressed-size limit before Mammoth to protect against DOCX zip bombs.
      return (await mammoth.extractRawText({buffer: file.buffer})).value;
    }

    const text = new TextDecoder('utf-8', {fatal: true}).decode(file.buffer).replace(/^\uFEFF/u, '');
    if (text.includes('\u0000')) throw new Error('Text file contains null bytes.');
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      'Could not read the uploaded document. Check that the file is not damaged or password-protected.',
      400,
    );
  }
}

export function titleFromFilename(filename: string): string {
  const safeFilename = filename.replace(/\\/g, '/').split('/').pop() ?? '';
  const title = safeFilename.replace(/\.[^.]+$/u, '').trim();
  if (!title || title.length > 200) throw new AppError('A file title must be between 1 and 200 characters.', 400);
  return title;
}
