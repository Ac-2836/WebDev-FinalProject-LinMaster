import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

import en from '../../messages/en.json';
import vi from '../../messages/vi.json';

const appDir = path.resolve(import.meta.dirname, '../../app');
const pages = readdirSync(appDir, {recursive: true, encoding: 'utf8'})
  .filter(file => ['page.tsx', 'not-found.tsx'].includes(path.basename(file)))
  // The landing page keeps the plain "LinMaster" title of the root layout.
  .filter(file => file.split(path.sep).join('/') !== '(public)/page.tsx');

describe('page titles (QA T3)', () => {
  it.each(pages)('%s has its own translated title', file => {
    const key = /pageTitle\('(\w+)'\)/u.exec(readFileSync(path.join(appDir, file), 'utf8'))?.[1];
    expect(key).toBeDefined();
    expect(vi.core.meta.titles).toHaveProperty(key!);
    expect(en.core.meta.titles).toHaveProperty(key!);
  });

  it('gives every page a different title', () => {
    const keys = pages.map(file => /pageTitle\('(\w+)'\)/u.exec(readFileSync(path.join(appDir, file), 'utf8'))?.[1]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
