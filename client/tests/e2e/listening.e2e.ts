import {expect, type Page, test} from '@playwright/test';
import {PDFDocument, StandardFonts} from 'pdf-lib';

import {cspViolations, endAttemptIn, registerUser} from './helpers';

test.afterEach(({page}) => expect(cspViolations(page)).toEqual([]));

const AUDIO_SECONDS = 3;

/** A Listening test PDF: page 1 the questions, page 2 the key. The title tells tests/e2e/mock-ai.mjs the skill. */
async function listeningPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('E2E Listening test');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const line of ['E2E Listening test: parts 1-4, questions 1-40', 'Answer key 1-40']) {
    pdf.addPage([595, 842]).drawText(line, {x: 50, y: 780, size: 14, font});
  }
  return Buffer.from(await pdf.save());
}

/** A silent constant-bitrate MP3 (MPEG-1 Layer III, 128 kbps, 44.1 kHz) of a few seconds, after an empty ID3 tag. */
function silentMp3(seconds: number): Buffer {
  const id3 = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]);
  const frameSize = 417; // 144 × 128000 / 44100
  const frames = Buffer.alloc(Math.ceil((seconds * 44_100) / 1152) * frameSize);
  for (let at = 0; at + frameSize <= frames.length; at += frameSize) frames.set([0xff, 0xfb, 0x90, 0x00], at);
  return Buffer.concat([id3, frames]);
}

async function choose(page: Page, box: string, file: {name: string; mimeType: string; buffer: Buffer}) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', {name: `Choose file: ${box}`}).click();
  await (await chooser).setFiles(file);
  await expect(page.getByText(file.name).first()).toBeVisible();
}

// Listening (P5-05): upload a test with its audio, the audio plays in the exam room under the CSP, and when the
// time runs out the attempt is submitted on its own with the answers given so far.
test('listening: the audio plays, and the test submits itself when time runs out', async ({page}) => {
  test.setTimeout(150_000);
  await registerUser(page, 'listening');

  await test.step('upload the questions, the key and the audio by template', async () => {
    await page.goto('/tests/new');
    await page.getByRole('tab', {name: 'By template'}).click();
    await page.getByRole('radio', {name: /^Listening/u}).check();
    await choose(page, 'Test', {name: 'e2e-listening.pdf', mimeType: 'application/pdf', buffer: await listeningPdf()});
    await page.getByRole('button', {name: 'Same file as Test'}).first().click();
    await choose(page, 'Audio', {name: 'e2e-listening.mp3', mimeType: 'audio/mpeg', buffer: silentMp3(AUDIO_SECONDS)});
    await page.getByRole('button', {name: 'Upload and read'}).click();
    await expect(page).toHaveURL(/\/tests\/imports\/[0-9a-f-]{36}$/u);
    await expect(page.getByRole('status').filter({hasText: 'The test is ready'})).toBeVisible({timeout: 60_000});
    await page.getByRole('link', {name: 'Take it now'}).click();
  });

  const audio = page.waitForResponse(res => /\/attempts\/[0-9a-f-]{36}\/audio/u.test(res.url()));
  await test.step('start the test: the audio is streamed to the room', async () => {
    await page
      .getByRole('link', {name: 'Start the test'})
      .or(page.getByRole('button', {name: 'Start the test'}))
      .click();
    await page.getByRole('button', {name: 'My details are correct'}).click();
    // Listening adds the sound check of the computer-based test.
    await expect(page.getByRole('heading', {name: 'Test your sound'})).toBeVisible();
    await page.getByRole('button', {name: 'Play sound'}).click();
    await page.getByRole('button', {name: 'Continue'}).click();
    await page.getByRole('button', {name: 'Start test'}).click();
    await expect(page).toHaveURL(/\/exam\/[0-9a-f-]{36}$/u);
    // The byte range of the audio played so far (PLAN C4); blocked by the CSP media-src, it would never answer.
    expect((await audio).status()).toBe(206);
  });

  const attemptId = page.url().split('/').at(-1)!;
  await test.step('answer two questions, one of them right', async () => {
    const question = (n: number) => page.getByRole('radiogroup', {name: `Question ${n}`, exact: true});
    await question(1).getByRole('radio', {name: /^B/u}).check();
    await question(2).getByRole('radio', {name: /^C/u}).check();
    await expect(page.getByRole('button', {name: /^Question 2, answered/u})).toBeVisible();
  });

  await test.step('the time runs out and the test submits itself', async () => {
    // As if the rest of the 32 minutes had passed: 5 seconds are left when the room opens again.
    await endAttemptIn(attemptId, 5);
    await page.reload();
    await expect(page.getByRole('heading', {name: 'Time is up'})).toBeVisible({timeout: 30_000});
    await page.getByRole('link', {name: 'See your result'}).click();
    await expect(page).toHaveURL(new RegExp(`/attempts/${attemptId}/result$`, 'u'));
    await expect(page.getByText(/submitted when time ran out/u)).toBeVisible();
    await expect(page.getByText('1/40 correct').first()).toBeVisible();
  });

  await test.step('the dashboard counts the test in its exam widgets', async () => {
    await page.goto('/dashboard');
    await expect(page.getByRole('region', {name: 'Band trend'}).getByText('No tests taken yet')).toHaveCount(0);
    await expect(page.getByRole('region', {name: 'Band trend'}).getByRole('img')).toBeVisible();
    const weak = page.getByRole('region', {name: 'Weak points by question type'});
    // Unanswered questions count as wrong: 1 right out of the 40 Listening questions.
    await expect(weak.getByRole('listitem').filter({hasText: 'Listening'}).getByText('1 of 40 correct')).toBeVisible();
  });
});
