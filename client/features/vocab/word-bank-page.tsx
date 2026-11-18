'use client';

import {
  CefrLevelSchema,
  DeleteVocabEntryResponseSchema,
  ListVocabDocumentsResponseSchema,
  ListVocabEntriesResponseSchema,
  VOCAB_TOPICS,
  type VocabEntry,
} from '@linmaster/shared';
import {CloudOff, Layers, NotebookPen, RotateCw, Search, SearchX, Trash2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {AlertDialog} from 'radix-ui';
import {useCallback, useEffect, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {useReturnFocus} from '@/components/ui/return-focus';
import {EmptyState} from '@/components/ui/empty-state';
import {Input, inputClass} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {CreateSetDialog, MAX_SET_WORDS} from './create-set-dialog';
import {EntryDrawer} from './entry-drawer';
import {useVocabLabels} from './vocab-labels';

const PAGE_SIZE = 20;
const card = 'rounded-[20px] border bg-card shadow-soft';
const grid = 'md:grid-cols-[40px_1.3fr_2fr_70px_1.4fr_90px]';

type List = {entries: VocabEntry[]; total: number; totalPages: number};

export interface WordBankPageProps {
  /** Pre-selected document filter (`/vocab?documentId=`), e.g. from the reader. */
  documentId?: string;
}

/** `/vocab` (C2, wireframe 03-vocab/word-bank): search, filter, delete and select saved words. */
export function WordBankPage({documentId: initialDocument = ''}: WordBankPageProps) {
  const t = useTranslations('vocab.bank');
  const confirmFocus = useReturnFocus();
  const labels = useVocabLabels();
  const errorMessage = useErrorMessage();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [cefr, setCefr] = useState('');
  const [topic, setTopic] = useState('');
  const [documentId, setDocumentId] = useState(initialDocument);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<List | null>(null);
  const [failed, setFailed] = useState(false);
  const [documents, setDocuments] = useState<{id: string; title: string}[]>([]);
  const [selected, setSelected] = useState(new Map<string, VocabEntry>());
  const [open, setOpen] = useState<VocabEntry | null>(null);
  const [confirm, setConfirm] = useState<VocabEntry[] | null>(null);
  const [creating, setCreating] = useState<string[] | null>(null);
  const filtered = Boolean(query || cefr || topic || documentId);

  // Wait for the user to stop typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(() => {
    setFailed(false);
    setList(null);
    const params = new URLSearchParams({page: String(page), pageSize: String(PAGE_SIZE)});
    if (query) params.set('q', query);
    if (cefr) params.set('cefr', cefr);
    if (topic) params.set('topic', topic);
    if (documentId) params.set('documentId', documentId);
    api(`/vocab/entries?${params}`)
      .then(res => {
        const {entries, pagination} = ListVocabEntriesResponseSchema.parse(res);
        setList({entries, total: pagination.total, totalPages: pagination.totalPages});
      })
      .catch(() => setFailed(true));
  }, [page, query, cefr, topic, documentId]);
  useEffect(load, [load]);

  useEffect(() => {
    api('/vocab/documents')
      .then(res => setDocuments(ListVocabDocumentsResponseSchema.parse(res).documents))
      .catch(() => setDocuments([]));
  }, []);

  function filter(set: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      set(e.target.value);
      setPage(1);
    };
  }

  function clearFilters() {
    setQ('');
    setQuery('');
    setCefr('');
    setTopic('');
    setDocumentId('');
    setPage(1);
  }

  async function remove(entries: VocabEntry[]) {
    const results = await Promise.allSettled(
      entries.map(async e =>
        DeleteVocabEntryResponseSchema.parse(await api(`/vocab/entries/${e.id}`, {method: 'DELETE'})),
      ),
    );
    const failedOne = results.find(r => r.status === 'rejected');
    if (failedOne) toast.error(errorMessage((failedOne as PromiseRejectedResult).reason));
    const done = results.filter(r => r.status === 'fulfilled').length;
    if (done) toast.success(t('deleted', {count: done}));
    setSelected(new Map());
    setOpen(null);
    load();
  }

  const pageEntries = list?.entries ?? [];
  const allChecked = pageEntries.length > 0 && pageEntries.every(e => selected.has(e.id));
  const toggle = (entry: VocabEntry, on: boolean) =>
    setSelected(s => {
      const next = new Map(s);
      if (on) next.set(entry.id, entry);
      else next.delete(entry.id);
      return next;
    });
  const from = (page - 1) * PAGE_SIZE + 1;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">
          {list && !filtered ? t('subtitleCount', {count: list.total}) : t('subtitle')}
        </p>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
          <select value={cefr} onChange={filter(setCefr)} aria-label={t('cefr')} className={cn(inputClass, 'lg:w-32')}>
            <option value="">{t('allCefr')}</option>
            {CefrLevelSchema.options.map(l => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={topic}
            onChange={filter(setTopic)}
            aria-label={t('topic')}
            className={cn(inputClass, 'lg:w-40')}
          >
            <option value="">{t('allTopics')}</option>
            {VOCAB_TOPICS.map(topicName => (
              <option key={topicName} value={topicName}>
                {labels.topic(topicName)}
              </option>
            ))}
          </select>
          <select
            value={documentId}
            onChange={filter(setDocumentId)}
            aria-label={t('document')}
            className={cn(inputClass, 'lg:w-48')}
          >
            <option value="">{t('allDocuments')}</option>
            {documents.map(d => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-secondary px-4 py-2">
          <p className="text-sm font-semibold text-primary" role="status">
            {t('selectedCount', {count: selected.size})}
          </p>
          <button
            type="button"
            onClick={() => setSelected(new Map())}
            className="min-h-11 text-sm text-primary hover:underline"
          >
            {t('clearSelection')}
          </button>
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirm([...selected.values()])}
              className="h-10 rounded-full text-destructive hover:bg-danger-soft hover:text-destructive"
            >
              <Trash2 aria-hidden="true" />
              {t('delete')}
            </Button>
            <Button
              onClick={() => setCreating([...selected.keys()])}
              disabled={selected.size > MAX_SET_WORDS}
              aria-describedby={selected.size > MAX_SET_WORDS ? 'set-limit' : undefined}
              className="h-10 rounded-full"
            >
              <Layers aria-hidden="true" />
              {t('createSet')}
            </Button>
          </div>
          {selected.size > MAX_SET_WORDS && (
            <p id="set-limit" className="w-full text-[13px] text-primary">
              {t('setLimit', {max: MAX_SET_WORDS})}
            </p>
          )}
        </div>
      )}

      {failed ? (
        <div role="alert" className={cn(card, 'flex flex-col items-center gap-3 p-10 text-center')}>
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
            <CloudOff className="size-6" aria-hidden="true" />
          </span>
          <p className="font-bold">{t('loadError')}</p>
          <Button variant="outline" className="h-10 rounded-full" onClick={load}>
            <RotateCw aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      ) : !list ? (
        <div className={cn(card, 'flex flex-col divide-y')} aria-busy="true" aria-label={t('loading')}>
          {Array.from({length: 6}, (_, i) => (
            <div key={i} className="flex gap-4 p-4">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : list.entries.length === 0 && !filtered ? (
        <EmptyState
          icon={NotebookPen}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          action={
            <Button asChild className="h-11 rounded-full px-5">
              <Link href="/read">{t('openReader')}</Link>
            </Button>
          }
        />
      ) : list.entries.length === 0 ? (
        <div className={cn(card, 'flex flex-col items-center gap-2 p-10 text-center')} role="status">
          <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-bold">{t('noResult')}</p>
          <Button variant="outline" className="h-10 rounded-full" onClick={clearFilters}>
            {t('clearFilters')}
          </Button>
        </div>
      ) : (
        <div className={cn(card, 'overflow-hidden')}>
          <div
            className={cn(
              'hidden gap-3 border-b bg-muted/50 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid',
              grid,
            )}
          >
            <input
              type="checkbox"
              className="size-4 accent-primary"
              aria-label={t('selectPage')}
              checked={allChecked}
              onChange={e => pageEntries.forEach(entry => toggle(entry, e.target.checked))}
            />
            <span>{t('colWord')}</span>
            <span>{t('colMeaning')}</span>
            <span>CEFR</span>
            <span>{t('colTopics')}</span>
            <span>{t('colContexts')}</span>
          </div>
          <ul className="divide-y">
            {list.entries.map(e => (
              <li
                key={e.id}
                className={cn('grid grid-cols-[28px_1fr_auto] items-start gap-3 px-4 py-3 md:items-center', grid)}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-primary md:mt-0"
                  aria-label={t('select', {word: e.headword})}
                  checked={selected.has(e.id)}
                  onChange={ev => toggle(e, ev.target.checked)}
                />
                <button
                  type="button"
                  onClick={() => setOpen(e)}
                  className="min-w-0 rounded text-left hover:text-primary"
                >
                  <span className="font-semibold break-words">{e.headword}</span>{' '}
                  <span className="text-[13px] text-muted-foreground">{labels.pos(e.partOfSpeech)}</span>
                  <span className="block text-[13px] text-muted-foreground md:hidden">{e.meaningVi}</span>
                  {e.ipa && <span className="hidden text-[13px] text-muted-foreground md:block">{e.ipa}</span>}
                </button>
                <span className="hidden text-sm md:block">{e.meaningVi}</span>
                <span>
                  {e.cefr && (
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {e.cefr}
                    </span>
                  )}
                </span>
                <span className="hidden text-sm text-muted-foreground md:block">
                  {e.topics.map(labels.topic).join(', ')}
                </span>
                <span className="hidden text-[13px] text-muted-foreground md:block">
                  {t('contextCount', {count: e.contexts.length})}
                </span>
              </li>
            ))}
          </ul>
          <nav
            className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm"
            aria-label={t('pagination')}
          >
            <span className="text-muted-foreground">
              {t('range', {from, to: from + list.entries.length - 1, total: list.total})}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                className="h-10 rounded-full"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                {t('prev')}
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-full"
                disabled={page >= list.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                {t('next')}
              </Button>
            </div>
          </nav>
        </div>
      )}

      <CreateSetDialog
        vocabIds={creating}
        onOpenChange={o => !o && setCreating(null)}
        onCreated={() => {
          setCreating(null);
          setSelected(new Map());
        }}
      />

      <EntryDrawer
        entry={open}
        onClose={() => setOpen(null)}
        onUpdated={entry => {
          setOpen(entry);
          setList(l => l && {...l, entries: l.entries.map(e => (e.id === entry.id ? entry : e))});
        }}
        onDelete={entry => setConfirm([entry])}
      />

      <AlertDialog.Root open={confirm !== null} onOpenChange={o => !o && setConfirm(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
          <AlertDialog.Content
            {...confirmFocus}
            className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-card p-6 shadow-2xl"
          >
            <AlertDialog.Title className="text-lg font-semibold">
              {t('confirmTitle', {count: confirm?.length ?? 0})}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              {t('confirmBody', {words: confirm?.map(e => e.headword).join(', ') ?? ''})}
            </AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" className="h-11 rounded-full px-5">
                  {t('cancel')}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="destructive"
                  className="h-11 rounded-full px-5"
                  onClick={() => confirm && remove(confirm)}
                >
                  {t('delete')}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
