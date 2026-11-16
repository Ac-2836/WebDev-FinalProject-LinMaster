import {expect, test} from '@playwright/test';

import {registerUser, selectWord} from './helpers';

const ARTICLE = [
  'Coastal cities face mounting pressure from rising seas.',
  'Governments are under pressure to mitigate the effects of flooding, yet funding for resilient infrastructure remains scarce.',
].join('\n\n');

// Study loop (P4-08): register → paste a document → look up a word → save → quick filter → set from the word
// bank → Flashcards and Learn (SM-2). AI replies come from tests/e2e/mock-ai.mjs.
test('study loop: read, look up, save, make a set and study it', async ({page}) => {
  await registerUser(page, 'study');

  await test.step('paste a document and open it in the reader', async () => {
    await page.goto('/read');
    await page.getByRole('button', {name: 'New document'}).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Paste English text here…').fill(ARTICLE);
    await dialog.getByRole('button', {name: 'Create and open'}).click();
    await expect(page).toHaveURL(/\/read\/[0-9a-f-]{36}$/u);
    await expect(
      page.getByRole('heading', {name: 'Coastal cities face mounting pressure from rising seas.'}),
    ).toBeVisible();
  });

  await test.step('look up a word in its sentence and save it', async () => {
    await selectWord(page, 'mitigate');
    await page.keyboard.press('t');
    await expect(page.getByText('nghĩa thử của mitigate')).toBeVisible();
    await page.getByRole('button', {name: 'Save to word bank'}).click();
    await expect(page.getByRole('tab', {name: 'Saved words (1)'})).toBeVisible();
  });

  await test.step('quick filter suggests words from the text and saves them', async () => {
    await page.getByRole('button', {name: 'Scan text'}).click();
    await page.getByRole('button', {name: /^Save 2 selected words$/u}).click();
    await expect(page.getByRole('tab', {name: 'Saved words (3)'})).toBeVisible();
  });

  await test.step('create a set from the word bank', async () => {
    await page.goto('/vocab');
    await expect(page.getByText('mitigate', {exact: true})).toBeVisible();
    // Closing the word's detail panel with Esc gives focus back to its row (QA T6).
    const row = page.getByRole('button', {name: /^mitigate/u});
    await row.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(row).toBeFocused();
    await page.getByRole('checkbox', {name: 'Select all words on this page'}).check();
    await page.getByRole('button', {name: 'Create set'}).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('For example: IELTS Environment').fill('E2E coastal words');
    await dialog.getByRole('button', {name: 'Create set'}).click();
    // The new set opens right away (QA T7).
    await expect(page).toHaveURL(/\/flashcards\/[0-9a-f-]{36}$/u);
    await expect(page.getByRole('heading', {name: 'E2E coastal words'})).toBeVisible();
    await expect(page.getByText('3 cards', {exact: true})).toBeVisible();
  });

  const setUrl = page.url();

  await test.step('flip through the cards', async () => {
    await page
      .getByRole('link', {name: /Flashcards/u})
      .last()
      .click();
    await expect(page.getByText('1 / 3')).toBeVisible();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('2 / 3')).toBeVisible();
  });

  await test.step('learn every card with SM-2 ratings', async () => {
    await page.goto(setUrl);
    await page.getByRole('link', {name: /Learn/u}).click();
    for (let card = 0; card < 3; card++) {
      await page.getByRole('button', {name: 'Show answer'}).click();
      await page.getByRole('button', {name: /Good/u}).click();
    }
    await expect(page.getByText('Session complete!')).toBeVisible();
    await expect(page.getByText('3 cards in', {exact: false})).toBeVisible();
  });
});
