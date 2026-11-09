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

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

function detectDocumentType(file: UploadedDocument): 'pdf' | 'docx' | 'txt' {
  const extension = extname(file.originalName).toLowerCase();
  const expectedMime = MIME_BY_EXTENSION[extension];
  if (!expectedMime || file.mimeType !== expectedMime) {
    throw new AppError('Only PDF, DOCX, and TXT files are supported.', 415, undefined, 'INVALID_ARGUMENT');
  }

  if (extension === '.pdf' && !file.buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) {
    throw new AppError('The uploaded file is not a valid PDF.', 400);
  }
  if (extension === '.docx' && !file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    throw new AppError('The uploaded file is not a valid DOCX document.', 400);
  }

  return extension.slice(1) as 'pdf' | 'docx' | 'txt';
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const loadingTask = getDocument({data: new Uint8Array(buffer), disableFontFace: true});
  const pdf = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map(item => {
            if (!('str' in item)) return '';
            return `${item.str}${item.hasEOL ? '\n' : ' '}`;
          })
          .join(''),
      );
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
    if (type === 'docx') return (await mammoth.extractRawText({buffer: file.buffer})).value;

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
