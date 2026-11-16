import {expect, type Page} from '@playwright/test';
// The server's Postgres driver; like pdf-lib in exam.e2e.ts it comes from the server workspace (no new dependency).
import pg from 'pg';

const WEB_URL = 'http://localhost:3100';
const violations = new WeakMap<Page, string[]>();

/** Content-Security-Policy violations the browser reported on the page since `registerUser` (P5-02). */
export function cspViolations(page: Page): string[] {
  return violations.get(page) ?? [];
}

/** Registers a new account (English interface) and lands on /home. */
export async function registerUser(page: Page, name: string): Promise<string> {
  const reported: string[] = [];
  violations.set(page, reported);
  page.on('console', message => {
    if (message.text().includes('Content Security Policy')) reported.push(message.text());
  });
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

export const API_URL = 'http://localhost:4100/api/v1';

/**
 * Calls the e2e API as the signed-in user of `page` (token from the `lm_token` cookie), to prepare data that is not
 * what the test is about (e.g. the cards of a set whose library page is tested).
 */
export async function apiAs<T>(page: Page, path: string, method = 'GET', body?: unknown): Promise<T> {
  const cookies = await page.context().cookies(WEB_URL);
  const token = cookies.find(cookie => cookie.name === 'lm_token')?.value;
  if (!token) throw new Error('No signed-in user on this page.');
  const res = await page.request.fetch(`${API_URL}${path}`, {
    method,
    headers: {Authorization: `Bearer ${token}`},
    data: body,
  });
  expect(res.ok(), `${method} ${path} answered ${res.status()}`).toBe(true);
  return (await res.json()) as T;
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

/**
 * Moves an attempt's clock so that it ends `seconds` from now, as if the learner had sat in the room for the rest
 * of the time: `startedAt` and `deadlineAt` shift back together (the sections are timed from `startedAt`). Only
 * on the e2e database, set by playwright.config.ts.
 */
export async function endAttemptIn(attemptId: string, seconds: number): Promise<void> {
  const client = new pg.Client({connectionString: process.env.E2E_DATABASE_URL});
  await client.connect();
  try {
    const {rowCount} = await client.query(
      `UPDATE "Attempt"
          SET "startedAt" = "startedAt" - ("deadlineAt" - now() - make_interval(secs => $2)),
              "deadlineAt" = now() + make_interval(secs => $2)
        WHERE id = $1 AND status = 'in_progress'`,
      [attemptId, seconds],
    );
    expect(rowCount, 'the attempt is in progress').toBe(1);
  } finally {
    await client.end();
  }
}
