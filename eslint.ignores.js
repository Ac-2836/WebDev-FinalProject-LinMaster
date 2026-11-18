module.exports = [
  '**/build/',
  '**/.next/',
  '**/node_modules/',
  '**/next-env.d.ts',
  // OCR files copied from node_modules (tesseract.js worker, WASM cores), minified and not ours.
  'client/public/ocr/',
  'server/src/generated/',
  'Analysis_Design/',
  'clone/',
  'graphify-out/',
];
