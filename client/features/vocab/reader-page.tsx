'use client';

import {
  GetVocabDocumentResponseSchema,
  MAX_LOOKUP_WORDS,
  SaveVocabEntriesResponseSchema,
  type VocabDocumentDetail,
  type VocabEntry,
} from '@linmaster/shared';
import {ArrowLeft, CloudOff, FileQuestion, MousePointerClick, RotateCw, Search, Sparkles} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {Dialog, Popover} from 'radix-ui';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {Skeleton} from '@/components/ui/skeleton';
import {api, ApiError} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {lookupWord} from './lookup';
import {LookupCard, type LookupState} from './lookup-card';
import {QuickFilterPanel, type SavedWord, useQuickFilter} from './quick-filter-panel';
import {layoutDocument, segmentParagraph, sentenceAround, tokenAt} from './reader-text';

export interface ReaderPageProps {
  id: string;
}

/** `/read/[id]` (C2, wireframe 03-vocab/reader): load the document, then hand it to the reader. */
export function ReaderPage({id}: ReaderPageProps) {
  const t = useTranslations('vocab.reader');
  const [document, setDocument] = useState<VocabDocumentDetail | null>(null);
  const [error, setError] = useState<'notFound' | 'failed' | null>(null);

  const load = useCallback(() => {
    setError(null);
    setDocument(null);
    api(`/vocab/documents/${id}`)
      .then(res => setDocument(GetVocabDocumentResponseSchema.parse(res).document))
      .catch(err => setError(err instanceof ApiError && err.httpStatus === 404 ? 'notFound' : 'failed'));
  }, [id]);
  useEffect(load, [load]);

  const back = (
    <Link
      href="/read"
      className="inline-flex min-h-11 items-center gap-1 text-[13px] text-muted-foreground hover:underline"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {t('back')}
    </Link>
  );

  if (error === 'notFound') {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <EmptyState icon={FileQuestion} title={t('notFoundTitle')} description={t('notFoundBody')} />
      </div>
    );
  }
  if (error === 'failed') {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-[20px] border bg-card p-10 text-center shadow-soft"
        >
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
            <CloudOff className="size-6" aria-hidden="true" />
          </span>
          <p className="font-bold">{t('loadError')}</p>
          <Button variant="outline" className="h-10 rounded-full" onClick={load}>
            <RotateCw aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      </div>
    );
  }
  if (!document) {
    return (
      <div className="flex max-w-[68ch] flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
        {back}
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
        {Array.from({length: 8}, (_, i) => (
          <Skeleton key={i} className={cn('h-4', i % 4 === 3 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {back}
      <Reader document={document} />
    </div>
  );
}

interface Range {
  start: number;
  end: number;
}

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    setDesktop(query.matches);
    const update = () => setDesktop(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return desktop;
}

function Reader({document}: {document: VocabDocumentDetail}) {
  const t = useTranslations('vocab.reader');
  const tDocs = useTranslations('vocab.documents');
  const errorMessage = useErrorMessage();
  const desktop = useIsDesktop();
  const article = useRef<HTMLElement>(null);
  const {paragraphs, tokens} = useMemo(() => layoutDocument(document.paragraphs.map(p => p.text)), [document]);
  const [saved, setSaved] = useState<Range[]>(() =>
    document.entries.flatMap(e =>
      e.contexts.flatMap(c =>
        c.startOffset === null || c.endOffset === null ? [] : [{start: c.startOffset, end: c.endOffset}],
      ),
    ),
  );
  const [words, setWords] = useState<SavedWord[]>(() => document.entries.map(e => ({id: e.id, headword: e.headword})));
  const [panelOpen, setPanelOpen] = useState(false);

  const filter = useQuickFilter({documentId: document.id, saved, onSaved: addSaved});

  /** After saving from the popover or the quick filter: count each entry once and highlight the new ranges. */
  function addSaved(entries: VocabEntry[], ranges: Range[]) {
    setWords(list => [
      ...list,
      ...entries.filter(e => !list.some(w => w.id === e.id)).map(e => ({id: e.id, headword: e.headword})),
    ]);
    setSaved(list => [...list, ...ranges]);
  }
  /** Selected words as an inclusive token index range. */
  const [selection, setSelection] = useState<{i: number; j: number} | null>(null);
  const [lookup, setLookup] = useState<{text: string; sentence: string; range: Range; state: LookupState} | null>(null);

  const range = selection && {start: tokens[selection.i].start, end: tokens[selection.j].end};
  const paragraphOf = (r: Range) => paragraphs[tokens[tokenAt(tokens, r.start, 'start')].p];
  const textOf = (r: Range) => {
    const p = paragraphOf(r);
    return p.text.slice(r.start - p.start, r.end - p.start);
  };
  const selectedText = range ? textOf(range) : '';

  const choose = useCallback(
    (i: number, j: number) => {
      if (tokens[i].p !== tokens[j].p) return toast.info(t('oneParagraph'));
      if (j - i + 1 > MAX_LOOKUP_WORDS) return toast.info(t('tooManyWords', {max: MAX_LOOKUP_WORDS}));
      setSelection({i, j});
    },
    [tokens, t],
  );

  /** Mouse/touch: snap the native selection to whole words. */
  function onPointerUp() {
    const native = window.getSelection();
    if (!native || native.isCollapsed || !native.rangeCount || !article.current) return;
    const r = native.getRangeAt(0);
    const a = offsetOf(r.startContainer, r.startOffset);
    const b = offsetOf(r.endContainer, r.endOffset);
    if (a === null || b === null) return;
    const i = tokenAt(tokens, a, 'start');
    const j = tokenAt(tokens, b, 'end');
    if (j < i) return;
    native.removeAllRanges();
    choose(i, j);
  }

  function offsetOf(node: Node, offset: number): number | null {
    if (!article.current?.contains(node)) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      const span = node.parentElement?.closest<HTMLElement>('[data-start]');
      return span ? Number(span.dataset.start) + offset : null;
    }
    // Element boundary (e.g. the whole paragraph): use the child at that position.
    const child = node.childNodes[Math.min(offset, node.childNodes.length - 1)] as HTMLElement | undefined;
    const start =
      child?.dataset?.start ??
      (child as Element | undefined)?.querySelector<HTMLElement>('[data-start]')?.dataset.start;
    return start === undefined
      ? null
      : Number(start) + (offset >= node.childNodes.length ? (child?.textContent?.length ?? 0) : 0);
  }

  async function startLookup() {
    if (!range) return;
    const p = paragraphOf(range);
    const text = textOf(range);
    const sentence = sentenceAround(p, range.start, range.end);
    setLookup({text, sentence, range, state: {status: 'loading'}});
    try {
      const {explanation, savedEntryId} = await lookupWord({text, sentence, documentId: document.id});
      setLookup(l => l && {...l, state: {status: 'ready', explanation, alreadySaved: savedEntryId !== null}});
    } catch (err) {
      const quota = err instanceof ApiError && err.status === 'AI_QUOTA_EXCEEDED';
      setLookup(l => l && {...l, state: {status: 'error', message: errorMessage(err), quota}});
    }
  }

  async function save() {
    if (!lookup || lookup.state.status !== 'ready') return;
    const {explanation, alreadySaved} = lookup.state;
    setLookup({...lookup, state: {status: 'saving', explanation, alreadySaved}});
    try {
      const {entries} = SaveVocabEntriesResponseSchema.parse(
        await api('/vocab/entries', {
          method: 'POST',
          body: {
            entries: [
              {
                ...explanation,
                context: {
                  sentence: lookup.sentence,
                  documentId: document.id,
                  startOffset: lookup.range.start,
                  endOffset: lookup.range.end,
                },
              },
            ],
          },
        }),
      );
      addSaved(entries, [lookup.range]);
      setLookup({...lookup, state: {status: 'saved', explanation, alreadySaved}});
    } catch (err) {
      toast.error(errorMessage(err));
      setLookup({...lookup, state: {status: 'ready', explanation, alreadySaved}});
    }
  }

  function closeLookup() {
    setLookup(null);
  }

  // "T" looks up the current selection from anywhere on the page (wireframe), unless the user is typing.
  useEffect(() => {
    if (!selection || lookup) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key.toLowerCase() !== 't' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      void startLookup();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, lookup, startLookup]);

  useEffect(() => {
    article.current?.querySelector('[data-active]')?.scrollIntoView({block: 'nearest'});
  }, [selection]);

  /** Keyboard selection: arrows move a word cursor, Shift+arrows grow it, Enter looks up, Esc clears. */
  function onKeyDown(e: React.KeyboardEvent) {
    const last = tokens.length - 1;
    const cur = selection ?? {i: 0, j: 0};
    const paragraphStart = (p: number) => tokens.findIndex(tok => tok.p === p);
    let next: {i: number; j: number} | null | undefined;
    switch (e.key) {
      case 'ArrowRight':
        if (!selection) next = cur;
        else if (e.shiftKey)
          next =
            cur.j < last && tokens[cur.j + 1].p === tokens[cur.i].p && cur.j - cur.i + 1 < MAX_LOOKUP_WORDS
              ? {i: cur.i, j: cur.j + 1}
              : cur;
        else next = {i: Math.min(cur.j + 1, last), j: Math.min(cur.j + 1, last)};
        break;
      case 'ArrowLeft':
        if (e.shiftKey) next = {i: cur.i, j: Math.max(cur.j - 1, cur.i)};
        else next = {i: Math.max(cur.i - 1, 0), j: Math.max(cur.i - 1, 0)};
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        const target = tokens[cur.i].p + (e.key === 'ArrowDown' ? 1 : -1);
        if (target < 0 || target >= paragraphs.length) return;
        const k = paragraphStart(target);
        next = k === -1 ? cur : {i: k, j: k};
        break;
      }
      case 'Enter':
        if (selection) {
          e.preventDefault();
          void startLookup();
        }
        return;
      case 'Escape':
        next = null;
        break;
      default:
        return;
    }
    e.preventDefault();
    setSelection(next ?? null);
  }

  const anchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => {
          const marks = [...(article.current?.querySelectorAll('[data-active]') ?? [])].map(m =>
            m.getBoundingClientRect(),
          );
          if (!marks.length) return new DOMRect();
          const left = Math.min(...marks.map(m => m.left));
          const top = Math.min(...marks.map(m => m.top));
          return new DOMRect(
            left,
            top,
            Math.max(...marks.map(m => m.right)) - left,
            Math.max(...marks.map(m => m.bottom)) - top,
          );
        },
      },
    }),
    [],
  );

  const highlights = range ? [...saved, range] : saved;
  const card = lookup && <LookupCard text={lookup.text} state={lookup.state} onSave={save} onClose={closeLookup} />;
  const returnFocus = (e: Event) => {
    e.preventDefault();
    article.current?.focus();
  };

  const panel = (
    <QuickFilterPanel documentId={document.id} wordCount={document.wordCount} words={words} filter={filter} />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <h1 className="mt-2 text-2xl leading-tight font-bold break-words sm:text-3xl">{document.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
            {tDocs(`source.${document.source}`)}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
            {tDocs('words', {count: document.wordCount})}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-primary">
            <span className="inline-block size-2 rounded-sm bg-mark" aria-hidden="true" />
            {t('savedCount', {count: words.length})}
          </span>
        </div>
        <p
          id="reader-help"
          className="mt-4 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-[13px] text-primary"
        >
          <MousePointerClick className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {t.rich('help', {
              max: MAX_LOOKUP_WORDS,
              kbd: chunks => <kbd className="rounded border bg-card px-1.5 font-mono text-xs">{chunks}</kbd>,
              b: chunks => <strong>{chunks}</strong>,
            })}
          </span>
        </p>

        <Popover.Root open={desktop && lookup !== null} onOpenChange={open => !open && closeLookup()}>
          <Popover.Anchor virtualRef={anchor} />
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="start"
              sideOffset={8}
              collisionPadding={16}
              onCloseAutoFocus={returnFocus}
              aria-label={t('lookupLabel', {text: lookup?.text ?? ''})}
              className="z-40 w-[380px] rounded-xl border bg-card p-4 shadow-2xl outline-none"
            >
              {card}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <Dialog.Root open={!desktop && lookup !== null} onOpenChange={open => !open && closeLookup()}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/30" />
            <Dialog.Content
              aria-describedby={undefined}
              onCloseAutoFocus={returnFocus}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl bg-card p-5 pb-8 shadow-2xl outline-none"
            >
              <span className="mx-auto h-1 w-10 rounded-full bg-border" aria-hidden="true" />
              <Dialog.Title className="sr-only">{t('lookupLabel', {text: lookup?.text ?? ''})}</Dialog.Title>
              {card}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <article
          ref={article}
          tabIndex={0}
          aria-label={t('articleLabel')}
          aria-describedby="reader-help"
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
          className="mt-6 flex max-w-[68ch] flex-col gap-5 rounded-lg font-serif text-[17px] leading-8 outline-offset-8"
        >
          {paragraphs.map((p, k) => (
            <p key={k}>
              {segmentParagraph(p, highlights).map(s => {
                const active = range !== null && s.mark === highlights.length - 1;
                if (active) {
                  return (
                    <span
                      key={s.start}
                      data-start={s.start}
                      data-active=""
                      className="rounded-sm bg-primary/15 ring-2 ring-primary"
                    >
                      {s.text}
                    </span>
                  );
                }
                if (s.mark >= 0) {
                  return (
                    <mark key={s.start} data-start={s.start}>
                      {s.text}
                    </mark>
                  );
                }
                return (
                  <span key={s.start} data-start={s.start}>
                    {s.text}
                  </span>
                );
              })}
            </p>
          ))}
        </article>

        {/* Screen readers hear what is selected; sighted users see the ring. */}
        <p className="sr-only" aria-live="polite">
          {selectedText && t('selected', {text: selectedText})}
        </p>
      </div>

      {desktop ? (
        <aside aria-label={t('panelLabel')}>
          <div className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-[20px] border bg-card shadow-soft">
            {panel}
          </div>
        </aside>
      ) : (
        <Dialog.Root open={panelOpen} onOpenChange={setPanelOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/30" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl outline-none"
            >
              <Dialog.Title className="sr-only">{t('panelLabel')}</Dialog.Title>
              {panel}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <div className="fixed right-4 bottom-24 z-30 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 lg:bottom-6">
        {selection && !lookup && (
          <Button size="lg" onClick={() => void startLookup()} className="h-12 max-w-full rounded-full shadow-lg">
            <Search aria-hidden="true" />
            <span className="truncate">{t('lookupButton', {text: selectedText})}</span>
          </Button>
        )}
        {!desktop && (
          <Button variant="outline" onClick={() => setPanelOpen(true)} className="h-11 rounded-full bg-card shadow-lg">
            <Sparkles aria-hidden="true" />
            {t('panelButton', {count: words.length})}
          </Button>
        )}
      </div>
    </div>
  );
}
