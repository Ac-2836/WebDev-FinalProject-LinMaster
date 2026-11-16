import {expect, test} from '@playwright/test';

import {apiAs, cspViolations, registerUser} from './helpers';

test.afterEach(({page}) => expect(cspViolations(page)).toEqual([]));

// Dashboard (P4-06, P5-05): the 7 widgets of a learner who saved one word and took no test yet. Each widget loads
// on its own; one with data shows it, one without shows its empty state, none shows the error state.
test('dashboard: all 7 widgets load, with data or their empty state', async ({page}) => {
  await registerUser(page, 'dashboard');

  await test.step('save one word from a pasted document', async () => {
    const sentence = 'Governments must mitigate the effects of flooding.';
    const {document} = await apiAs<{document: {id: string}}>(page, '/vocab/documents', 'POST', {
      title: 'E2E dashboard text',
      text: sentence,
    });
    await apiAs(page, '/vocab/entries', 'POST', {
      entries: [
        {
          headword: 'mitigate',
          lemma: 'mitigate',
          partOfSpeech: 'verb',
          meaningVi: 'giảm nhẹ',
          cefr: 'C1',
          topics: ['environment'],
          context: {sentence, documentId: document.id, startOffset: 17, endOffset: 25},
        },
      ],
    });
  });

  await page.goto('/dashboard');
  const widget = (name: string | RegExp) => page.getByRole('region', {name});
  const widgets = {
    activity: widget(/^1 activity in the past/u),
    numbers: widget('Numbers'),
    bands: widget('Band trend'),
    vocab: widget('Vocabulary'),
    weaknesses: widget('Weak points by question type'),
    topics: widget('Most studied topics'),
    community: widget('Community'),
  };

  await test.step('every widget is on the page and none failed to load', async () => {
    for (const region of Object.values(widgets)) await expect(region).toBeVisible();
    await expect(page.getByText('Could not load this part')).toHaveCount(0);
  });

  await test.step('widgets with data show the saved word', async () => {
    await expect(widgets.numbers.getByText('Words saved')).toBeVisible();
    await expect(widgets.vocab.getByText('1 word', {exact: true})).toBeVisible();
    await expect(widgets.topics.getByText('environment · 1')).toBeVisible();
  });

  await test.step('widgets without data show their empty state and a way forward', async () => {
    await expect(widgets.bands.getByText('No tests taken yet')).toBeVisible();
    await expect(widgets.bands.getByRole('link', {name: 'Take your first test'})).toHaveAttribute('href', '/tests');
    await expect(widgets.weaknesses.getByText('Take at least one test to see this.')).toBeVisible();
    await expect(widgets.community.getByText('You have not shared anything yet')).toBeVisible();
  });
});
