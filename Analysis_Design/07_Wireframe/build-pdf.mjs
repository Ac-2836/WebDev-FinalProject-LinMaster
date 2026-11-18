/*
 * Builds wireframes.pdf from the wireframe pages: a cover, then one page per screen with the desktop (1440px) and
 * mobile (375px) versions side by side. The screen list is the one in assets/wf.js (window.WF_SCREENS), so adding a
 * screen there adds it to the PDF.
 *
 *   node Analysis_Design/07_Wireframe/build-pdf.mjs
 *
 * Needs `playwright` with a Chromium browser (already used by the client e2e: `npx playwright install chromium`) and
 * network access, because the wireframes load Tailwind, the font and the icons from a CDN. Run it after any
 * wireframe change, so the PDF never falls behind the HTML.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {chromium} from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'wireframes.pdf');
const DESKTOP = {width: 1440, height: 900};
const MOBILE = {width: 375, height: 812};
const PAGE_W = 1069; // 802 pt, the width of the first version of this PDF
const SHOW_DESKTOP = 720; // 0.5 of 1440
const SHOW_MOBILE = 255; // 0.68 of 375
const PAD = 24;

const browser = await chromium.launch();
try {
  // `file` may carry a query (room-reading.html?state=submit); pathToFileURL would escape the "?".
  const url = file => {
    const [path, query] = file.split('?');
    return pathToFileURL(join(here, path)).href + (query ? `?${query}` : '');
  };
  const index = await browser.newPage();
  await index.goto(url('index.html'));
  const groups = await index.evaluate(() => window.WF_SCREENS);
  await index.close();

  // One shot per screen and size. `?shot` hides the state panel and the table-of-contents button.
  async function shoot(size, file) {
    const context = await browser.newContext({viewport: size, deviceScaleFactor: 1.5});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url(file) + (file.includes('?') ? '&shot' : '?shot'), {waitUntil: 'networkidle'});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const image = await page.screenshot({fullPage: true, type: 'jpeg', quality: 82});
    await context.close();
    if (errors.length) throw new Error(`${file}: ${errors[0]}`);
    return {src: `data:image/jpeg;base64,${image.toString('base64')}`, height};
  }

  const screens = [];
  for (const [group, items] of groups) {
    for (const [file, name, note] of items) {
      const [desktop, mobile] = [await shoot(DESKTOP, file), await shoot(MOBILE, file)];
      screens.push({group, file, name, note, desktop, mobile});
      console.log(`${screens.length}. ${file}`);
    }
  }

  const sizes = screens.map(s => {
    const body = Math.max(
      Math.ceil((s.desktop.height * SHOW_DESKTOP) / DESKTOP.width),
      Math.ceil((s.mobile.height * SHOW_MOBILE) / MOBILE.width),
    );
    return PAD + 74 + 22 + body + PAD;
  });
  const css = sizes.map((h, i) => `@page s${i} {size: ${PAGE_W}px ${h}px; margin: 0}`).join('\n');
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const logo = `data:image/svg+xml;base64,${readFileSync(join(here, 'assets/logo-mark.svg')).toString('base64')}`;
  const date = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  const pages = screens
    .map(
      (s, i) => `<section class="screen" style="page: s${i}; height: ${sizes[i]}px">
  <p class="eyebrow">${esc(s.file.split('/')[0].replace(/^(\d+)-.*/, '$1'))} · ${esc(s.group)}</p>
  <h1>${esc(s.name)}${s.note ? `<span>${esc(s.note)}</span>` : ''}</h1>
  <div class="row">
    <figure><figcaption>Desktop 1440px</figcaption><img src="${s.desktop.src}" style="width: ${SHOW_DESKTOP}px"></figure>
    <figure><figcaption>Mobile 375px</figcaption><img src="${s.mobile.src}" style="width: ${SHOW_MOBILE}px"></figure>
  </div>
</section>`,
    )
    .join('\n');

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap">
<style>
@page cover {size: ${PAGE_W}px 640px; margin: 0}
${css}
* {box-sizing: border-box} body {margin: 0; font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #0b2545; background: #f8f9fc; -webkit-print-color-adjust: exact; print-color-adjust: exact}
.cover {page: cover; height: 640px; padding: 140px 64px; break-after: page}
.cover img {width: 100px; border-radius: 26px} .cover h1 {margin: 48px 0 8px; font-size: 40px; letter-spacing: -0.03em}
.cover h2 {margin: 0 0 20px; font-size: 20px; color: #1a5cff} .cover p {margin: 4px 0; font-size: 13px; color: #476788}
.screen {padding: ${PAD}px; overflow: hidden; break-after: page} .screen:last-child {break-after: auto}
.eyebrow {margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #476788}
h1 {margin: 4px 0 18px; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.25}
h1 span {margin-left: 14px; font-size: 13px; font-weight: 400; letter-spacing: 0; color: #476788}
.row {display: flex; align-items: flex-start; gap: ${PAD}px} figure {margin: 0}
figcaption {margin-bottom: 6px; font-size: 11px; font-weight: 600; color: #476788} img {display: block; border: 1px solid #e3e8f1; border-radius: 8px; background: #fff}
</style></head><body>
<section class="cover"><img src="${logo}" alt="">
  <h1>LinMaster</h1><h2>Wireframe — toàn bộ màn hình</h2>
  <p>${screens.length} màn · mỗi màn có bản desktop 1440px và mobile 375px</p>
  <p>Bản bấm được: Analysis_Design/07_Wireframe/index.html · sinh ngày ${date} bằng build-pdf.mjs</p></section>
${pages}
</body></html>`;

  const page = await browser.newPage();
  await page.setContent(html, {waitUntil: 'networkidle'});
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({path: out, preferCSSPageSize: true, printBackground: true});
  console.log(`${screens.length + 1} pages -> ${out}`);
} finally {
  await browser.close();
}
