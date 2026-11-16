import {expect, type Page, test} from '@playwright/test';

import {registerUser} from './helpers';

// P5-01: checks of the QA report that a unit test cannot see (layout, focus, titles), in both languages.
const PAGES = ['/home', '/read', '/vocab', '/flashcards', '/flashcards/new', '/tests', '/tests/new', '/library'];
const MORE_PAGES = ['/dashboard', '/profile'];
const WEB_URL = 'http://localhost:3100';

const useLocale = (page: Page, locale: 'en' | 'vi') =>
  page.context().addCookies([{name: 'NEXT_LOCALE', value: locale, url: WEB_URL}]);

/** Opens the page at 375px: its own title (QA T3, never "Page not found", QA C2) and no sideways scroll. */
async function checkPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('main')).toBeVisible();
  await expect(page).toHaveTitle(/ · LinMaster$/u);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${path} scrolls sideways at 375px`).toBeLessThanOrEqual(0);
  return page.title();
}

/** QA T4: every navbar tab stays one line high at 1440px. */
async function checkNavbar(page: Page) {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/home');
  const heights = await page
    .locator('header nav')
    .getByRole('link')
    .evaluateAll(links => links.map(link => link.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeLessThanOrEqual(40);
}

test('register: an empty form puts focus on the first field (QA T5)', async ({page}) => {
  await useLocale(page, 'en');
  await page.goto('/register');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page.getByLabel('Display name')).toBeFocused();
  await expect(page).toHaveTitle('Create account · LinMaster');
});

test('every page has its own title, fits 375px and keeps the navbar on one line', async ({page}) => {
  test.setTimeout(150_000);
  await registerUser(page, 'a11y');

  for (const locale of ['en', 'vi'] as const) {
    await useLocale(page, locale);
    await page.setViewportSize({width: 375, height: 812});
    const titles = new Set<string>();
    for (const path of [...PAGES, ...MORE_PAGES]) titles.add(await checkPage(page, path));
    expect(titles.size).toBe(PAGES.length + MORE_PAGES.length);
    if (locale === 'vi') expect(titles).toContain('Kho từ · LinMaster');
    await checkNavbar(page);
  }
});
