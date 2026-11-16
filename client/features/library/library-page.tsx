'use client';

import {LibraryListResponseSchema, type LibraryItem, type LibraryListResponse} from '@linmaster/shared';
import {ClipboardCheck, CloudOff, Copy, Layers, RotateCw, Search, SearchX, Users} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Link from 'next/link';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {Tabs} from 'radix-ui';
import {useEffect, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {inputClass} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {api} from '@/core/api/client';
import {initials} from '@/core/nav/account-menu';

import {filterQuery, listPath, readFilters, type LibraryFilters} from './library-logic';

export const card = 'rounded-[20px] border bg-card shadow-soft';
export const badge =
  'inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground';
const tabClass =
  'inline-flex min-h-11 items-center gap-1.5 border-b-2 border-transparent px-4 text-sm font-semibold text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:border-primary data-[state=active]:text-primary';

/** `/library` (PLAN C5, wireframe 06-library/library): public card sets and tests of other learners. */
export function LibraryPage() {
  const t = useTranslations('library.list');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = readFilters(new URLSearchParams(params.toString()));
  const key = listPath(filters);
  const [result, setResult] = useState<{key: string; data: LibraryListResponse | null}>({key: '', data: null});
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(filters.q);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setFailed(false);
    api(key)
      .then(res => live && setResult({key, data: LibraryListResponseSchema.parse(res)}))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [key, attempt]);

  const go = (patch: Partial<LibraryFilters>) => {
    const qs = filterQuery({...filters, page: 1, ...patch});
    router.replace(qs ? `${pathname}?${qs}` : pathname, {scroll: false});
  };
  const data = result.key === key ? result.data : null;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Tabs.Root value={filters.type} onValueChange={type => go({type: type as LibraryFilters['type']})}>
        <Tabs.List aria-label={t('tabs')} className="flex border-b">
          <Tabs.Trigger value="set" className={tabClass}>
            <Layers className="size-4" aria-hidden="true" />
            {t('sets')}
          </Tabs.Trigger>
          <Tabs.Trigger value="test" className={tabClass}>
            <ClipboardCheck className="size-4" aria-hidden="true" />
            {t('tests')}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value={filters.type} className="mt-5 flex flex-col gap-5 outline-none">
          <div className="flex flex-col gap-3 md:flex-row">
            <form
              role="search"
              className="relative flex-1"
              onSubmit={e => {
                e.preventDefault();
                go({q: query.trim()});
              }}
            >
              <label htmlFor="library-q" className="sr-only">
                {t('search')}
              </label>
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="library-q"
                type="search"
                className={cn(inputClass, 'pl-9')}
                placeholder={t(filters.type === 'set' ? 'searchSets' : 'searchTests')}
                maxLength={100}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </form>
            <div className="grid grid-cols-2 gap-2 md:flex">
              {filters.type === 'test' && (
                <select
                  aria-label={t('skill')}
                  className={cn(inputClass, 'md:w-40')}
                  value={filters.skill}
                  onChange={e => go({skill: e.target.value as LibraryFilters['skill']})}
                >
                  <option value="">{t('allSkills')}</option>
                  <option value="listening">Listening</option>
                  <option value="reading">Reading</option>
                </select>
              )}
              <select
                aria-label={t('sort')}
                className={cn(inputClass, 'md:w-40', filters.type === 'set' && 'col-span-2')}
                value={filters.sort}
                onChange={e => go({sort: e.target.value as LibraryFilters['sort']})}
              >
                <option value="new">{t('sortNew')}</option>
                <option value="popular">{t('sortPopular')}</option>
              </select>
            </div>
          </div>

          {failed ? (
            <EmptyState
              icon={CloudOff}
              title={t('loadError')}
              action={
                <Button variant="outline" onClick={() => setAttempt(n => n + 1)}>
                  <RotateCw className="size-4" aria-hidden="true" />
                  {t('retry')}
                </Button>
              }
            />
          ) : !data ? (
            <div role="status" aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <span className="sr-only">{t('loading')}</span>
              {Array.from({length: 6}, (_, i) => (
                <Skeleton key={i} className="h-40 rounded-[20px]" />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={filters.q || filters.skill ? SearchX : Users}
              title={
                filters.q
                  ? t(filters.type === 'set' ? 'noSetsFor' : 'noTestsFor', {q: filters.q})
                  : t(filters.type === 'set' ? 'noSets' : 'noTests')
              }
              description={t(filters.type === 'set' ? 'emptySetsHint' : 'emptyTestsHint')}
              action={
                (filters.q || filters.skill) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery('');
                      go({q: '', skill: ''});
                    }}
                  >
                    {t('clear')}
                  </Button>
                )
              }
            />
          ) : (
            <>
              <p role="status" className="sr-only">
                {t('found', {count: data.pagination.total})}
              </p>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map(item => (
                  <li key={item.id} className="min-w-0">
                    <ItemCard item={item} />
                  </li>
                ))}
              </ul>
              {data.pagination.totalPages > 1 && (
                <nav aria-label={t('pages')} className="flex items-center justify-center gap-2">
                  <Button variant="outline" disabled={filters.page <= 1} onClick={() => go({page: filters.page - 1})}>
                    {t('prev')}
                  </Button>
                  <span className="px-2 text-sm text-muted-foreground" aria-current="page">
                    {t('page', {page: filters.page, total: data.pagination.totalPages})}
                  </span>
                  <Button
                    variant="outline"
                    disabled={filters.page >= data.pagination.totalPages}
                    onClick={() => go({page: filters.page + 1})}
                  >
                    {t('next')}
                  </Button>
                </nav>
              )}
            </>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

export function Author({name, children}: {name: string; children?: React.ReactNode}) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold"
      >
        {initials(name)}
      </span>
      {name}
      {children}
    </p>
  );
}

function ItemCard({item}: {item: LibraryItem}) {
  const t = useTranslations('library.list');
  const format = useFormatter();
  const compact = (n: number) => format.number(n, {notation: 'compact'});
  const isSet = item.type === 'set';
  return (
    <Link
      href={`/library/${isSet ? 'sets' : 'tests'}/${item.id}`}
      className={cn(
        card,
        'flex h-full flex-col gap-3 p-5 outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring',
      )}
    >
      <span className="flex items-center gap-2">
        <span className={badge}>
          {isSet ? `${item.termLang.toUpperCase()} → ${item.definitionLang.toUpperCase()}` : skillsLabel(item.skills)}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {isSet && <Copy className="size-3.5" aria-hidden="true" />}
          {isSet
            ? t('copies', {count: item.copyCount, display: compact(item.copyCount)})
            : t('attempts', {count: item.attemptCount, display: compact(item.attemptCount)})}
        </span>
      </span>
      <span className="font-bold break-words">{item.title}</span>
      <span className="text-sm text-muted-foreground">
        {isSet
          ? t('cards', {count: item.cardCount})
          : t('testInfo', {questions: item.questionCount, minutes: Math.round(item.durationSec / 60)})}
      </span>
      <span className="mt-auto">
        <Author name={item.author.displayName} />
      </span>
    </Link>
  );
}

export const skillsLabel = (skills: string[]) =>
  skills.length > 1 ? 'Full' : skills[0] === 'listening' ? 'Listening' : 'Reading';
