import {ocrPages, type OcrProgress} from './ocr-logic';

// Served by this site (client/public/ocr, copied by scripts/copy-ocr-assets.mjs): no third-party CDN.
const ASSETS = '/ocr';
// A PDF page is 72 dpi; 2x is about 150 dpi, enough for printed text and small enough for a phone.
const RENDER_SCALE = 2;

/**
 * Reads the text of every page of a PDF in the browser: pdf.js draws each page, tesseract.js (WASM, in a worker)
 * recognises it, one page at a time. The server never sees an image, only the text.
 */
export async function recognizePdf(
  file: File,
  onProgress: (progress: OcrProgress) => void,
  signal?: AbortSignal,
): Promise<string[]> {
  // Loaded only here: the library and the model are several MB and only the upload page needs them.
  const [pdfjs, {createWorker}] = await Promise.all([import('pdfjs-dist'), import('tesseract.js')]);
  pdfjs.GlobalWorkerOptions.workerSrc = `${ASSETS}/pdf.worker.min.mjs`;

  const loading = pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer())});
  const document = await loading.promise;
  const worker = await createWorker('eng', 1, {
    workerPath: `${ASSETS}/worker.min.js`,
    // Absolute: the worker loads these with importScripts and fetch, which resolve against the worker.
    corePath: `${window.location.origin}${ASSETS}`,
    langPath: `${window.location.origin}${ASSETS}`,
    gzip: true,
    // Load the worker from its own file, not a blob, so the policy only needs worker-src 'self'.
    workerBlobURL: false,
  });
  try {
    return await ocrPages(
      document.numPages,
      async number => {
        const page = await document.getPage(number);
        const canvas = window.document.createElement('canvas');
        try {
          const viewport = page.getViewport({scale: RENDER_SCALE});
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          // 'print' draws without requestAnimationFrame, which a background tab stops: the learner may switch tabs
          // while the pages are being read, and the reading must go on.
          await page.render({canvas, viewport, intent: 'print'}).promise;
          return (await worker.recognize(canvas)).data.text;
        } finally {
          // Free the image before the next page: pages are read one at a time to keep memory flat.
          canvas.width = canvas.height = 0;
          page.cleanup();
        }
      },
      onProgress,
      signal,
    );
  } finally {
    await worker.terminate();
    await loading.destroy();
  }
}
