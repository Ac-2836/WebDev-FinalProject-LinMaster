import {describe, expect, it} from 'vitest';

import {ApiError} from '@/core/api/client';

import {filterQuery, libraryStatus, listPath, readFilters} from './library-logic';

describe('library', () => {
  it('reads filters from the URL and falls back on unknown values', () => {
    expect(readFilters(new URLSearchParams('type=test&q=%20sea%20&skill=reading&sort=popular&page=3'))).toEqual({
      type: 'test',
      q: 'sea',
      skill: 'reading',
      sort: 'popular',
      page: 3,
    });
    expect(readFilters(new URLSearchParams('type=x&skill=speaking&sort=old&page=-2'))).toEqual({
      type: 'set',
      q: '',
      skill: '',
      sort: 'new',
      page: 1,
    });
  });

  it('writes only what differs from the defaults, and skill only for tests', () => {
    const base = {type: 'set', q: '', skill: 'reading', sort: 'new', page: 1} as const;
    expect(filterQuery(base)).toBe('');
    expect(filterQuery({...base, type: 'test', page: 2})).toBe('type=test&skill=reading&page=2');
    expect(listPath(base)).toBe('/library?type=set&pageSize=12');
  });

  it('recognises library error statuses', () => {
    expect(libraryStatus(new ApiError('OWN_CONTENT', 409))).toBe('OWN_CONTENT');
    expect(libraryStatus(new ApiError('NOT_FOUND', 404))).toBeNull();
    expect(libraryStatus(new Error('x'))).toBeNull();
  });
});
