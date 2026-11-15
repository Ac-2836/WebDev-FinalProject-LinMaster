import {LibraryErrorStatusSchema, type LibrarySort, type LibraryType, type Skill} from '@linmaster/shared';

import {ApiError} from '@/core/api/client';

export const PAGE_SIZE = 12;

export interface LibraryFilters {
  type: LibraryType;
  q: string;
  skill: Skill | '';
  sort: LibrarySort;
  page: number;
}

/** Filters from the page URL, so Back from a preview returns to the same list. Unknown values fall back. */
export function readFilters(params: URLSearchParams): LibraryFilters {
  const page = Number(params.get('page'));
  const skill = params.get('skill');
  return {
    type: params.get('type') === 'test' ? 'test' : 'set',
    q: params.get('q')?.trim() ?? '',
    skill: skill === 'listening' || skill === 'reading' ? skill : '',
    sort: params.get('sort') === 'popular' ? 'popular' : 'new',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** Query string of the filters without the defaults; `skill` only applies to tests. */
export function filterQuery(f: LibraryFilters) {
  const params = new URLSearchParams();
  if (f.type !== 'set') params.set('type', f.type);
  if (f.q) params.set('q', f.q.slice(0, 100));
  if (f.type === 'test' && f.skill) params.set('skill', f.skill);
  if (f.sort !== 'new') params.set('sort', f.sort);
  if (f.page > 1) params.set('page', String(f.page));
  return params.toString();
}

/** `GET /library` for the filters; the API defaults `type` to `set`, so it is always sent. */
export function listPath(f: LibraryFilters) {
  const params = new URLSearchParams(filterQuery(f));
  params.set('type', f.type);
  params.set('pageSize', String(PAGE_SIZE));
  return `/library?${params}`;
}

/** The library module status of an error (`OWN_CONTENT`…), when it is one, for its own message. */
export function libraryStatus(error: unknown) {
  return error instanceof ApiError ? (LibraryErrorStatusSchema.safeParse(error.status).data ?? null) : null;
}
