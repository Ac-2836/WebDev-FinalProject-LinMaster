'use client';

import {
  CefrLevelSchema,
  SaveVocabEntriesResponseSchema,
  ScanDocumentResponseSchema,
  VOCAB_TOPICS,
  type ScanCandidate,
  type VocabEntry,
} from '@linmaster/shared';
import {BookmarkPlus, CircleAlert, LoaderCircle, Sparkles} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {Tabs} from 'radix-ui';
import {useId, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

const LEVELS = CefrLevelSchema.options;
const chip =
  'inline-flex cursor-pointer items-center justify-center rounded-lg border px-2.5 text-sm font-semibold peer-checked:border-primary peer-checked:bg-secondary peer-checked:text-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring';

export interface SavedWord {
  id: string;
  headword: string;
}

export interface QuickFilterOptions {
  documentId: string;
  /** Ranges already highlighted in the text; candidates on them are shown as saved. */
  saved: {start: number; end: number}[];
  onSaved: (entries: VocabEntry[], ranges: {start: number; end: number}[]) => void;
}

/**
 * Quick-filter state, kept by the reader so scan results survive closing the mobile sheet.
 * The panel below only renders it.
 */
export function useQuickFilter({documentId, saved, onSaved}: QuickFilterOptions) {
  const t = useTranslations('vocab.scan');
  const errorMessage = useErrorMessage();
  const [levels, setLevels] = useState<string[]>(['B2', 'C1', 'C2']);
  const [topics, setTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [status, setStatus] = useState<'form' | 'scanning' | 'results' | 'saving'>('form');
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [checked, setChecked] = useState(new Set<number>());
  const [error, setError] = useState<string | null>(null);

  const isSaved = (c: ScanCandidate) => saved.some(r => r.start < c.endOffset && r.end > c.startOffset);
  const open = candidates.map((c, i) => i).filter(i => !isSaved(candidates[i]));
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  async function scan(event: React.FormEvent) {
    event.preventDefault();
    const allTopics = [
      ...topics,
      ...customTopic
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    ];
    setError(null);
    setStatus('scanning');
    try {
      const res = ScanDocumentResponseSchema.parse(
        await api(`/vocab/documents/${documentId}/scan`, {
          method: 'POST',
          body: {...(levels.length && {levels}), ...(allTopics.length && {topics: allTopics})},
        }),
      );
      setCandidates(res.candidates);
      setChecked(new Set(res.candidates.flatMap((c, i) => (isSaved(c) ? [] : [i]))));
      setStatus('results');
    } catch (err) {
      setError(errorMessage(err));
      setStatus('form');
    }
  }

  async function save() {
    const picked = [...checked].sort((a, b) => a - b).map(i => candidates[i]);
    setStatus('saving');
    try {
      const {entries} = SaveVocabEntriesResponseSchema.parse(
        await api('/vocab/entries', {
          method: 'POST',
          body: {
            entries: picked.map(({sentence, startOffset, endOffset, ...word}) => ({
              ...word,
              context: {sentence, documentId, startOffset, endOffset},
            })),
          },
        }),
      );
      onSaved(
        entries,
        picked.map(c => ({start: c.startOffset, end: c.endOffset})),
      );
      setChecked(new Set());
      toast.success(t('savedToast', {count: picked.length}));
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setStatus('results');
  }

  return {
    ...{levels, setLevels, topics, setTopics, customTopic, setCustomTopic, status, setStatus},
    ...{candidates, checked, setChecked, error, isSaved, open, toggle, scan, save},
  };
}

export interface QuickFilterPanelProps {
  documentId: string;
  wordCount: number;
  words: SavedWord[];
  filter: ReturnType<typeof useQuickFilter>;
}

/** Reader side panel (C2, wireframe 03-vocab/reader): "Lọc nhanh" scan + the words saved from this document. */
export function QuickFilterPanel({documentId, wordCount, words, filter}: QuickFilterPanelProps) {
  const t = useTranslations('vocab.scan');
  const ids = useId();
  const {levels, setLevels, topics, setTopics, customTopic, setCustomTopic, status, setStatus} = filter;
  const {candidates, checked, setChecked, error, isSaved, open, toggle, scan, save} = filter;

  const tab =
    'flex-1 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary';

  return (
    <Tabs.Root defaultValue="scan" className="flex min-h-0 flex-col">
      <Tabs.List className="flex border-b" aria-label={t('panelLabel')}>
        <Tabs.Trigger value="scan" className={tab}>
          {t('tab')}
        </Tabs.Trigger>
        <Tabs.Trigger value="saved" className={tab}>
          {t('savedTab', {count: words.length})}
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="scan" className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
        {status === 'form' || status === 'scanning' ? (
          <form onSubmit={scan} className="flex flex-col gap-4">
            <p className="text-[13px] text-muted-foreground">{t('intro')}</p>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t('levels')}</legend>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map(level => (
                  <label key={level}>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={levels.includes(level)}
                      onChange={() => setLevels(l => toggle(l, level))}
                    />
                    <span className={cn(chip, 'h-9 min-w-11')}>{level}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">
                {t('topics')} <span className="font-normal text-muted-foreground">{t('optional')}</span>
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {VOCAB_TOPICS.map(topic => (
                  <label key={topic}>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={topics.includes(topic)}
                      onChange={() => setTopics(l => toggle(l, topic))}
                    />
                    <span className={cn(chip, 'h-8 rounded-full text-xs font-medium capitalize')}>{topic}</span>
                  </label>
                ))}
              </div>
              <label htmlFor={`${ids}-topic`} className="sr-only">
                {t('customTopic')}
              </label>
              <Input
                id={`${ids}-topic`}
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                placeholder={t('customTopic')}
                className="mt-2"
              />
            </fieldset>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="h-11 rounded-full"
              disabled={status === 'scanning'}
              aria-busy={status === 'scanning'}
            >
              {status === 'scanning' ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {status === 'scanning' ? t('scanning', {count: wordCount}) : t('scan')}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold" role="status">
                {t('resultCount', {count: candidates.length})}
              </p>
              <button
                type="button"
                onClick={() => setStatus('form')}
                className="min-h-11 text-sm font-semibold text-primary hover:underline"
              >
                {t('again')}
              </button>
            </div>
            {candidates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('none')}</p>
            ) : (
              <>
                {open.length > 0 && (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={open.every(i => checked.has(i))}
                      onChange={e => setChecked(new Set(e.target.checked ? open : []))}
                    />
                    {t('selectAll')}
                  </label>
                )}
                <ul className="flex flex-col divide-y rounded-lg border">
                  {candidates.map((c, i) => {
                    const done = isSaved(c);
                    return (
                      <li key={`${c.startOffset}-${c.lemma}`}>
                        <label
                          className={cn('flex gap-3 p-3', done ? 'opacity-70' : 'cursor-pointer hover:bg-muted/50')}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 size-4 shrink-0 accent-primary"
                            checked={done || checked.has(i)}
                            disabled={done}
                            onChange={e =>
                              setChecked(s => {
                                const next = new Set(s);
                                if (e.target.checked) next.add(i);
                                else next.delete(i);
                                return next;
                              })
                            }
                          />
                          <span className="min-w-0 flex-1 text-sm">
                            <span className="flex items-center gap-1.5">
                              <strong>{c.headword}</strong>
                              <span className="text-muted-foreground">{c.partOfSpeech}</span>
                              <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-primary">
                                {c.cefr}
                              </span>
                            </span>
                            <span className="block">{c.meaningVi}</span>
                            <span className="block truncate font-serif text-[13px] text-muted-foreground italic">
                              “{c.sentence}”
                            </span>
                            {done && (
                              <span className="text-[13px] font-semibold text-success">{t('alreadySaved')}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  className="h-11 rounded-full"
                  onClick={save}
                  disabled={checked.size === 0 || status === 'saving'}
                  aria-busy={status === 'saving'}
                >
                  {status === 'saving' ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <BookmarkPlus aria-hidden="true" />
                  )}
                  {t('save', {count: checked.size})}
                </Button>
              </>
            )}
          </div>
        )}
      </Tabs.Content>

      <Tabs.Content value="saved" className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        {words.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noSaved')}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {words.map(w => (
              <li key={w.id} className="rounded-full bg-mark px-2.5 py-0.5 text-sm font-semibold">
                {w.headword}
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/vocab?documentId=${documentId}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
        >
          {t('openBank')}
        </Link>
      </Tabs.Content>
    </Tabs.Root>
  );
}
