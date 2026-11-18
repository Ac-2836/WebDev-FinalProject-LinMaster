/*
 * Copies what in-browser OCR loads at run time into client/public/ocr, so the site serves it itself (no third-party
 * CDN, and the content security policy can stay on 'self'): the tesseract.js worker, the WASM core variants and the
 * English model, plus the pdf.js worker. Versions come from node_modules, so they always match the lockfile.
 * Runs before `dev` and `build`; the output is not committed.
 */
import {copyFileSync, existsSync, mkdirSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ocr');
const packageDir = name => dirname(require.resolve(`${name}/package.json`));

// The English model is LSTM only, so only the LSTM cores are needed. tesseract.js picks the fastest one the browser
// can run (plain, SIMD, relaxed SIMD).
const files = [
  [join(packageDir('tesseract.js'), 'dist', 'worker.min.js'), 'worker.min.js'],
  ...['tesseract-core-lstm', 'tesseract-core-simd-lstm', 'tesseract-core-relaxedsimd-lstm'].map(core => [
    join(packageDir('tesseract.js-core'), `${core}.wasm.js`),
    `${core}.wasm.js`,
  ]),
  [join(packageDir('@tesseract.js-data/eng'), '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz'],
  [join(packageDir('pdfjs-dist'), 'build', 'pdf.worker.min.mjs'), 'pdf.worker.min.mjs'],
];

rmSync(out, {recursive: true, force: true});
mkdirSync(out, {recursive: true});
for (const [from, name] of files) {
  if (!existsSync(from)) throw new Error(`OCR asset missing: ${from}`);
  copyFileSync(from, join(out, name));
}
process.stdout.write(`OCR assets copied to ${out} (${files.length} files)\n`);
