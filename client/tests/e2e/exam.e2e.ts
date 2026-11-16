import {expect, type Page, test} from '@playwright/test';
import {PDFDocument, StandardFonts} from 'pdf-lib';

import {cspViolations, registerUser} from './helpers';

test.afterEach(({page}) => expect(cspViolations(page)).toEqual([]));

/** A two-page test PDF: page 1 the passage and questions, page 2 the answer key (read by tests/e2e/mock-ai.mjs). */
async function testPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const line of ['E2E Reading test: passage and questions 1-40', 'Answer key 1-40']) {
    pdf.addPage([595, 842]).drawText(line, {x: 50, y: 780, size: 14, font});
  }
  return Buffer.from(await pdf.save());
}

/** Uploads a Reading test in the "By template" tab (AI mocked), waits for the import and opens the exam room. */
async function uploadAndStart(page: Page, name: string): Promise<void> {
  await registerUser(page, name);

  await test.step('upload one PDF for the Test and Answers boxes', async () => {
    await page.goto('/tests/new');
    await page.getByRole('tab', {name: 'By template'}).click();
    await page.getByRole('radio', {name: /^Reading/u}).check();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', {name: 'Choose file: Test'}).click();
    await (await chooser).setFiles({name: 'e2e-reading.pdf', mimeType: 'application/pdf', buffer: await testPdf()});
    await expect(page.getByText(/e2e-reading\.pdf/u).first()).toBeVisible();
    await page.getByRole('button', {name: 'Same file as Test'}).first().click();
    await page.getByRole('button', {name: 'Upload and read'}).click();
  });

  await test.step('the import job builds the test', async () => {
    await expect(page).toHaveURL(/\/tests\/imports\/[0-9a-f-]{36}$/u);
    await expect(page.getByRole('status').filter({hasText: 'The test is ready'})).toBeVisible({timeout: 60_000});
    await page.getByRole('link', {name: 'Take it now'}).click();
  });

  await test.step('pass the screens before the exam', async () => {
    await page
      .getByRole('link', {name: 'Start the test'})
      .or(page.getByRole('button', {name: 'Start the test'}))
      .click();
    await page.getByRole('button', {name: 'My details are correct'}).click();
    await page.getByRole('button', {name: 'Start test'}).click();
    await expect(page).toHaveURL(/\/exam\/[0-9a-f-]{36}$/u);
  });
}

const choice = (page: Page, question: number, value: string) =>
  page
    .getByRole('radiogroup', {name: `Question ${question}`, exact: true})
    .getByRole('radio', {name: value, exact: true});

// Exam loop (P4-08): upload by template (AI mocked) → start → answer → submit → result.
// The fake key is TRUE for odd question numbers and FALSE for even ones.
test('exam loop: upload by template, take the test, submit and see the result', async ({page}) => {
  test.setTimeout(150_000);
  await uploadAndStart(page, 'exam');

  await test.step('answer questions and submit', async () => {
    await choice(page, 1, 'TRUE').check();
    await choice(page, 2, 'FALSE').check();
    await choice(page, 3, 'FALSE').check();
    await page.getByRole('button', {name: 'Submit test'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Submit'}).click();
  });

  await test.step('the result shows the score and every question', async () => {
    const result = page.getByRole('link', {name: 'See your result'});
    await expect(result.or(page.getByText(/\/40 correct/u).first())).toBeVisible();
    if (await result.isVisible()) await result.click();
    await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}\/result$/u);
    await expect(page.getByText('2/40 correct').first()).toBeVisible();
    await page.getByRole('checkbox', {name: /Wrong only/u}).check();
    await expect(page.getByText(/Wrong only \(\d+\)/u)).toBeVisible();
  });
});

// Regression (QA 15/11): a choice must be recorded on the first click, not one interaction late.
test('exam room keeps an answer chosen with one click', async ({page}) => {
  test.setTimeout(150_000);
  await uploadAndStart(page, 'answer');

  await choice(page, 1, 'TRUE').check();
  await expect(page.getByRole('button', {name: /^Question 1, answered/u})).toBeVisible({timeout: 5_000});
  await page.reload();
  await expect(choice(page, 1, 'TRUE')).toBeChecked({timeout: 5_000});
});
