import {expect, type Page} from '@playwright/test';

const WEB_URL = 'http://localhost:3100';

/** Registers a new account (English interface) and lands on /home. */
export async function registerUser(page: Page, name: string): Promise<string> {
  await page.context().addCookies([{name: 'NEXT_LOCALE', value: 'en', url: WEB_URL}]);
  const email = `e2e-${name}-${Date.now()}@example.test`;
  await page.goto('/register');
  await page.getByLabel('Display name').fill(`E2E ${name}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', {exact: true}).fill('E2e-password-2026');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page).toHaveURL(/\/home$/u);
  return email;
}

/** Selects one word inside the text of the page, like a double-click with the mouse. */
export async function selectWord(page: Page, word: string): Promise<void> {
  const box = await page.evaluate(target => {
    const walker = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent?.indexOf(target) ?? -1;
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + target.length);
      const rect = range.getBoundingClientRect();
      return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
    }
    return null;
  }, word);
  if (!box) throw new Error(`"${word}" is not on the page.`);
  await page.mouse.dblclick(box.x, box.y);
}
