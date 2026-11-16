import {expect, test} from '@playwright/test';

import {apiAs, cspViolations, registerUser} from './helpers';

test.afterEach(({page}) => expect(cspViolations(page)).toEqual([]));

// Library (P4-02, P5-05): one learner publishes a card set, another finds it, previews it and copies it; the owner
// then sees the copy on the dashboard.
test('library: publish a set, another learner finds, previews and copies it', async ({page, browser}) => {
  test.setTimeout(150_000);
  const title = `E2E shared set ${Date.now()}`;

  const setId = await test.step('the owner publishes a set of two cards', async () => {
    await registerUser(page, 'owner');
    const {set} = await apiAs<{set: {id: string}}>(page, '/flashcards/sets', 'POST', {title});
    await apiAs(page, `/flashcards/sets/${set.id}/cards`, 'PUT', {
      cards: [
        {term: 'mitigate', definition: 'giảm nhẹ'},
        {term: 'resilient', definition: 'kiên cường'},
      ],
    });
    await page.goto(`/flashcards/${set.id}`);
    await expect(page.getByRole('heading', {name: 'Only you can see this'})).toBeVisible();
    await page.getByRole('button', {name: 'Publish', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'In the library'})).toBeVisible();
    return set.id;
  });

  const learner = await browser.newPage();
  await test.step('another learner finds the set in the library', async () => {
    await registerUser(learner, 'learner');
    await learner.goto('/library');
    await learner.getByRole('searchbox', {name: 'Search the library'}).fill(title);
    await learner.keyboard.press('Enter');
    // Earlier runs left other "E2E shared set" items on the test database: the search keeps only this one.
    await expect(learner).toHaveURL(/[?&]q=/u);
    await expect(learner.getByRole('link', {name: /E2E shared set/u})).toHaveCount(1);
    const item = learner.getByRole('link', {name: new RegExp(title, 'u')});
    await item.click();
    await expect(learner).toHaveURL(new RegExp(`/library/sets/${setId}$`, 'u'));
  });

  await test.step('the preview shows every card, and the copy opens as the learner own set', async () => {
    await expect(learner.getByRole('heading', {name: title})).toBeVisible();
    await expect(learner.getByText('resilient', {exact: true})).toBeVisible();
    await learner.getByRole('button', {name: 'Copy to my library'}).click();
    await expect(learner.getByText('Copied 2 cards to your card sets.', {exact: false})).toBeVisible();
    await learner.getByRole('link', {name: 'Copied · Open the set'}).click();
    await expect(learner).toHaveURL(/\/flashcards\/[0-9a-f-]{36}$/u);
    expect(learner.url()).not.toContain(setId);
    await expect(learner.getByRole('heading', {name: title})).toBeVisible();
    await expect(learner.getByText('2 cards', {exact: true})).toBeVisible();
    expect(cspViolations(learner)).toEqual([]);
  });

  await test.step('the owner sees the copy in the Community widget', async () => {
    await page.goto('/dashboard');
    const community = page.getByRole('region', {name: 'Community'});
    await expect(community.getByText(/card set shared · 1 copy/u)).toBeVisible();
  });
  await learner.close();
});
