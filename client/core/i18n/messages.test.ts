import {IntlMessageFormat} from 'intl-messageformat';
import {describe, expect, it} from 'vitest';

import en from '../../messages/en.json';
import vi from '../../messages/vi.json';

type Tree = {[key: string]: string | Tree};

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === 'string' ? [[`${prefix}${key}`, value]] : Object.entries(flatten(value, `${prefix}${key}.`)),
    ),
  );
}

const messages = {en: flatten(en as Tree), vi: flatten(vi as Tree)};

describe('interface messages', () => {
  it('has the same keys in Vietnamese and English (nothing left untranslated)', () => {
    expect(Object.keys(messages.vi).sort()).toEqual(Object.keys(messages.en).sort());
    const empty = Object.entries({...messages.vi, ...messages.en}).filter(([, value]) => !value.trim());
    expect(empty).toEqual([]);
  });

  it.each(['en', 'vi'] as const)('parses every %s message as ICU', locale => {
    const broken = Object.entries(messages[locale]).filter(([, value]) => {
      try {
        new IntlMessageFormat(value, locale, undefined, {ignoreTag: true});
        return false;
      } catch {
        return true;
      }
    });
    expect(broken.map(([key]) => key)).toEqual([]);
  });

  it('writes English counts in the singular for one (QA T1)', () => {
    const format = (key: string, values: Record<string, unknown>) =>
      new IntlMessageFormat(messages.en[key], 'en', undefined, {ignoreTag: true}).format(values);
    const cardCount = Object.keys(messages.en).find(
      key => messages.en[key] === '{count, plural, one {# card} other {# cards}}',
    )!;
    expect(format(cardCount, {count: 1})).toBe('1 card');
    expect(format(cardCount, {count: 3})).toBe('3 cards');
    // "{count} cards" reads "1 cards"; inside a plural block the noun is chosen by the number.
    const plain = Object.entries(messages.en).filter(
      ([, value]) =>
        !value.includes(', plural,') &&
        /\{\w+\} (cards|words|sentences|activities|questions|copies|attempts)\b/u.test(value),
    );
    expect(plain.map(([key]) => key)).toEqual([]);
  });
});
