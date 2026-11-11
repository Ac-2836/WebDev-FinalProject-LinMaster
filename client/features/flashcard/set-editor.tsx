'use client';

import {
  CreateFlashcardSetResponseSchema,
  GetFlashcardSetResponseSchema,
  ReplaceFlashcardCardsResponseSchema,
  type FlashcardCard,
  type FlashcardSet,
} from '@linmaster/shared';
import {
  ArrowLeft,
  CircleAlert,
  CloudOff,
  GripVertical,
  Link2,
  LoaderCircle,
  NotebookPen,
  Plus,
  RotateCw,
  Trash2,
} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCallback, useEffect, useRef, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {Input, inputClass} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {api, ApiError} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {changes, invalidKeys, move, newRow, type Row, rowsFromCards, toCards} from './editor-rows';

const LANGS = ['en', 'vi'] as const;
const card = 'rounded-[20px] border bg-card shadow-soft';
const cellInput = 'rounded-none border-0 border-b px-0 focus:ring-0';

export interface SetEditorProps {
  /** Edit this set; without it the editor creates a new one. */
  id?: string;
}

/** `/flashcards/new` and `/flashcards/[id]/edit` (C3, wireframe 04-flashcard/editor). */
export function SetEditor({id}: SetEditorProps) {
  const t = useTranslations('flashcard.editor');
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [error, setError] = useState<'notFound' | 'failed' | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    api(`/flashcards/sets/${id}`)
      .then(res => setSet(GetFlashcardSetResponseSchema.parse(res).set))
      .catch(err => setError(err instanceof ApiError && err.httpStatus === 404 ? 'notFound' : 'failed'));
  }, [id]);
  useEffect(load, [load]);

  if (!id) return <Editor />;
  if (error) {
    return (
      <div role="alert" className={cn(card, 'mx-auto flex max-w-4xl flex-col items-center gap-3 p-10 text-center')}>
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
          <CloudOff className="size-6" aria-hidden="true" />
        </span>
        <p className="font-bold">{error === 'notFound' ? t('notFound') : t('loadError')}</p>
        {error === 'failed' ? (
          <Button variant="outline" className="h-10 rounded-full" onClick={load}>
            <RotateCw aria-hidden="true" />
            {t('retry')}
          </Button>
        ) : (
          <Button asChild variant="outline" className="h-10 rounded-full">
            <Link href="/flashcards">{t('backToSets')}</Link>
          </Button>
        )}
      </div>
    );
  }
  if (!set) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-40 w-full rounded-[20px]" />
        <Skeleton className="h-36 w-full rounded-[20px]" />
        <Skeleton className="h-36 w-full rounded-[20px]" />
      </div>
    );
  }
  return <Editor set={set} />;
}

function Editor({set}: {set?: FlashcardSet}) {
  const t = useTranslations('flashcard.editor');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const original: FlashcardCard[] = set?.cards ?? [];
  const [setId, setSetId] = useState(set?.id);
  const [title, setTitle] = useState(set?.title ?? '');
  const [description, setDescription] = useState(set?.description ?? '');
  const [termLang, setTermLang] = useState(set?.termLang ?? 'en');
  const [definitionLang, setDefinitionLang] = useState(set?.definitionLang ?? 'vi');
  const [rows, setRows] = useState<Row[]>(() => (set ? rowsFromCards(set.cards) : [newRow(), newRow()]));
  const [dirty, setDirty] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const dragFrom = useRef<number | null>(null);
  const list = useRef<HTMLOListElement>(null);

  const invalid = invalidKeys(rows);
  const titleMissing = !title.trim();
  const diff = changes(original, rows);
  const count = toCards(rows).length;

  // Leaving with unsaved changes asks first (reload, close tab, typed URL).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (!focusKey) return;
    list.current?.querySelector<HTMLElement>(`[data-row="${focusKey}"] [data-field="term"]`)?.focus();
    setFocusKey(null);
  }, [focusKey]);

  function update(next: Row[]) {
    setRows(next);
    setDirty(true);
  }
  const edit = (key: string, field: 'term' | 'definition' | 'example', value: string) =>
    update(rows.map(r => (r.key === key ? {...r, [field]: value} : r)));
  function addRow() {
    const row = newRow();
    update([...rows, row]);
    setFocusKey(row.key);
  }
  function moveRow(from: number, to: number, focusHandle = false) {
    const next = move(rows, from, to);
    if (next === rows) return;
    update(next);
    setAnnounce(t('moved', {from: from + 1, to: to + 1}));
    if (focusHandle) {
      requestAnimationFrame(() =>
        list.current?.querySelector<HTMLElement>(`[data-row="${rows[from].key}"] [data-handle]`)?.focus(),
      );
    }
  }

  async function save() {
    setShowErrors(true);
    setSaveError(null);
    if (titleMissing || invalid.size > 0) {
      const target = titleMissing
        ? document.getElementById('set-title')
        : list.current?.querySelector<HTMLElement>(`[data-row="${[...invalid][0]}"] [data-field="term"]`);
      target?.focus();
      return;
    }
    setSaving(true);
    const meta = {
      title: title.trim(),
      description: description.trim() || null,
      termLang,
      definitionLang,
    };
    try {
      let target = setId;
      if (!target) {
        target = CreateFlashcardSetResponseSchema.parse(await api('/flashcards/sets', {method: 'POST', body: meta})).set
          .id;
        // If saving the cards fails below, a retry updates this set instead of creating another one.
        setSetId(target);
      } else if (
        !set ||
        meta.title !== set.title ||
        meta.description !== set.description ||
        termLang !== set.termLang ||
        definitionLang !== set.definitionLang
      ) {
        await api(`/flashcards/sets/${target}`, {method: 'PATCH', body: meta});
      }
      ReplaceFlashcardCardsResponseSchema.parse(
        await api(`/flashcards/sets/${target}/cards`, {method: 'PUT', body: {cards: toCards(rows)}}),
      );
      setDirty(false);
      router.push(`/flashcards/${target}`);
    } catch (err) {
      setSaveError(errorMessage(err));
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm(t('confirmLeave'))) return;
    router.push(set ? `/flashcards/${set.id}` : '/flashcards');
  }

  const summary = [
    diff.added > 0 && t('added', {count: diff.added}),
    diff.edited > 0 && t('edited', {count: diff.edited}),
    diff.removed > 0 && t('removed', {count: diff.removed}),
    diff.reordered && t('reordered'),
  ].filter(Boolean);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-24">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" className="size-11" onClick={cancel} aria-label={t('back')}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h1 className="flex-1 text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">
          {set ? t('editTitle') : t('newTitle')}
        </h1>
      </header>

      <section className={cn(card, 'flex flex-col gap-4 p-5')}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="set-title" className="text-sm font-semibold">
            {t('titleLabel')}
          </label>
          <Input
            id="set-title"
            value={title}
            onChange={e => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            maxLength={200}
            placeholder={t('titlePlaceholder')}
            aria-invalid={showErrors && titleMissing}
            aria-describedby={showErrors && titleMissing ? 'set-title-error' : undefined}
            className="text-base font-semibold"
          />
          {showErrors && titleMissing && (
            <p id="set-title-error" className="flex items-center gap-1 text-[13px] text-destructive">
              <CircleAlert className="size-3.5" aria-hidden="true" />
              {t('titleRequired')}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="set-description" className="text-sm font-semibold">
            {t('description')} <span className="font-normal text-muted-foreground">{t('optional')}</span>
          </label>
          <textarea
            id="set-description"
            value={description}
            onChange={e => {
              setDescription(e.target.value);
              setDirty(true);
            }}
            maxLength={2000}
            className={cn(inputClass, 'min-h-16 py-2')}
          />
        </div>
        <div className="grid grid-cols-2 items-end gap-3 sm:max-w-sm">
          {(
            [
              ['term-lang', t('termLang'), termLang, setTermLang],
              ['definition-lang', t('definitionLang'), definitionLang, setDefinitionLang],
            ] as const
          ).map(([fieldId, label, value, setValue]) => (
            <div key={fieldId} className="flex flex-col gap-1.5">
              <label htmlFor={fieldId} className="text-sm font-semibold">
                {label}
              </label>
              <select
                id={fieldId}
                value={value}
                onChange={e => {
                  setValue(e.target.value);
                  setDirty(true);
                }}
                className={inputClass}
              >
                {LANGS.map(l => (
                  <option key={l} value={l}>
                    {t(`lang.${l}`)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-xl font-semibold">{t('cardCount', {count})}</h2>
        <Button asChild variant="outline" className="h-10 rounded-full">
          <Link href="/vocab">
            <NotebookPen aria-hidden="true" />
            {t('fromBank')}
          </Link>
        </Button>
      </div>
      <p id="reorder-help" className="sr-only">
        {t('reorderHelp')}
      </p>

      <ol ref={list} className="flex flex-col gap-3">
        {rows.map((row, i) => {
          const bad = showErrors && invalid.has(row.key);
          const last = i === rows.length - 1;
          return (
            <li
              key={row.key}
              data-row={row.key}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragFrom.current !== null) moveRow(dragFrom.current, i);
                dragFrom.current = null;
              }}
              className={cn(card, bad && 'border-destructive/50')}
            >
              <div className="flex items-center gap-2 border-b px-3 py-1.5 text-sm">
                <button
                  type="button"
                  draggable
                  data-handle=""
                  onDragStart={() => (dragFrom.current = i)}
                  onKeyDown={e => {
                    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                    e.preventDefault();
                    moveRow(i, i + (e.key === 'ArrowUp' ? -1 : 1), true);
                  }}
                  aria-label={t('handle', {n: i + 1})}
                  aria-describedby="reorder-help"
                  className="inline-flex size-11 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <GripVertical className="size-4" aria-hidden="true" />
                </button>
                <span className="font-semibold text-muted-foreground">{i + 1}</span>
                {row.vocabEntryId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Link2 className="size-3" aria-hidden="true" />
                    {t('linked')}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-11"
                  onClick={() => update(rows.filter(r => r.key !== row.key))}
                  aria-label={t('deleteCard', {n: i + 1})}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {(['term', 'definition', 'example'] as const).map(field => (
                  <div
                    key={field}
                    className={cn('flex flex-col-reverse gap-1', field === 'example' && 'sm:col-span-2')}
                  >
                    <label
                      htmlFor={`${row.key}-${field}`}
                      className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                      {t(field)}
                      {field === 'example' && <span className="font-normal normal-case"> {t('optional')}</span>}
                    </label>
                    <Input
                      id={`${row.key}-${field}`}
                      data-field={field}
                      value={row[field]}
                      onChange={e => edit(row.key, field, e.target.value)}
                      maxLength={field === 'term' ? 500 : 2000}
                      aria-invalid={bad && field !== 'example' && !row[field].trim()}
                      aria-describedby={bad ? `${row.key}-error` : undefined}
                      onKeyDown={
                        field === 'example' && last
                          ? e => {
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault();
                                addRow();
                              }
                            }
                          : undefined
                      }
                      className={cn(cellInput, field === 'example' && 'text-muted-foreground')}
                    />
                  </div>
                ))}
                {bad && (
                  <p
                    id={`${row.key}-error`}
                    className="flex items-center gap-1 text-[13px] text-destructive sm:col-span-2"
                  >
                    <CircleAlert className="size-3.5" aria-hidden="true" />
                    {t('rowInvalid')}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <button
        type="button"
        onClick={addRow}
        className="flex min-h-16 items-center justify-center gap-2 rounded-xl border-2 border-dashed font-semibold text-muted-foreground hover:border-primary hover:text-primary"
      >
        <Plus className="size-5" aria-hidden="true" />
        {t('addCard')}
      </button>
      <p className="text-[13px] text-muted-foreground">
        {t.rich('tabTip', {kbd: chunks => <kbd className="rounded border bg-card px-1 font-mono">{chunks}</kbd>})}
      </p>

      <div className="fixed inset-x-0 bottom-[68px] z-20 border-t bg-card/95 backdrop-blur lg:bottom-0">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          {saveError ? (
            <p role="alert" className="flex min-w-0 items-center gap-1 text-sm text-destructive">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t('saveError', {reason: saveError})}</span>
            </p>
          ) : (
            <p className="hidden min-w-0 truncate text-[13px] text-muted-foreground sm:block" role="status">
              {saving ? t('saving') : summary.length > 0 ? summary.join(' · ') : dirty ? t('unsaved') : ''}
            </p>
          )}
          <div className="ml-auto flex shrink-0 gap-2">
            <Button variant="outline" className="h-11 rounded-full px-5" onClick={cancel}>
              {t('cancel')}
            </Button>
            <Button className="h-11 rounded-full px-5" onClick={save} disabled={saving} aria-busy={saving}>
              {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {t('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
