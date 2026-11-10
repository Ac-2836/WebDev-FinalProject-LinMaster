'use client';

import {
  DeleteVocabDocumentResponseSchema,
  ListVocabDocumentsResponseSchema,
  type VocabDocument,
} from '@linmaster/shared';
import {
  BookOpenText,
  ClipboardCheck,
  ClipboardList,
  CloudOff,
  EllipsisVertical,
  FileText,
  Plus,
  RotateCw,
  Search,
  Trash2,
} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Link from 'next/link';
import {AlertDialog, DropdownMenu} from 'radix-ui';
import {useCallback, useEffect, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {Input, inputClass} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {NewDocumentDialog} from './new-document-dialog';

type DocumentItem = Omit<VocabDocument, 'paragraphs'>;
type Source = DocumentItem['source'];

const SOURCE_ICON = {paste: ClipboardList, file: FileText, exam: ClipboardCheck};
const card = 'flex flex-col gap-3 rounded-[20px] border bg-card p-5 shadow-soft';

/** `/read` (C2, wireframe 03-vocab/documents): the user's reading documents. */
export function DocumentsPage() {
  const t = useTranslations('vocab.documents');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<Source | ''>('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    setDocuments(null);
    api('/vocab/documents')
      .then(res => setDocuments(ListVocabDocumentsResponseSchema.parse(res).documents))
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  async function remove(document: DocumentItem) {
    try {
      DeleteVocabDocumentResponseSchema.parse(await api(`/vocab/documents/${document.id}`, {method: 'DELETE'}));
      setDocuments(list => list?.filter(d => d.id !== document.id) ?? null);
      toast.success(t('deleted', {title: document.title}));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const q = query.trim().toLowerCase();
  const shown = documents?.filter(d => (!source || d.source === source) && d.title.toLowerCase().includes(q));
  const newButton = (
    <Button onClick={() => setCreating(true)} className="h-11 rounded-full px-5">
      <Plus aria-hidden="true" />
      {t('new')}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <p className="eyebrow text-muted-foreground">{t('eyebrow')}</p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">
            {t('title')}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </div>
        {newButton}
      </header>

      {failed ? (
        <div role="alert" className={cn(card, 'items-center p-10 text-center')}>
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
            <CloudOff className="size-6" aria-hidden="true" />
          </span>
          <p className="font-bold">{t('loadError')}</p>
          <Button variant="outline" className="h-10 rounded-full" onClick={load}>
            <RotateCw aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      ) : !documents ? (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label={t('loading')}>
          {Array.from({length: 6}, (_, i) => (
            <li key={i} className={card}>
              <Skeleton className="size-10 rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </li>
          ))}
        </ul>
      ) : documents.length === 0 ? (
        <EmptyState icon={BookOpenText} title={t('emptyTitle')} description={t('emptyBody')} action={newButton} />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('search')}
                aria-label={t('search')}
                className="pl-9"
              />
            </div>
            <select
              value={source}
              onChange={e => setSource(e.target.value as Source | '')}
              aria-label={t('sourceFilter')}
              className={cn(inputClass, 'sm:w-48')}
            >
              <option value="">{t('allSources')}</option>
              {(['paste', 'file', 'exam'] as const).map(s => (
                <option key={s} value={s}>
                  {t(`source.${s}`)}
                </option>
              ))}
            </select>
          </div>
          {shown?.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground" role="status">
              {t('noMatch')}
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {shown?.map(d => {
                const Icon = SOURCE_ICON[d.source];
                return (
                  <li key={d.id} className={card}>
                    <div className="flex items-start gap-3">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <Link
                        href={`/read/${d.id}`}
                        className="min-w-0 flex-1 leading-snug font-semibold break-words hover:text-primary"
                      >
                        {d.title}
                      </Link>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <Button variant="ghost" size="icon" aria-label={t('options', {title: d.title})}>
                            <EllipsisVertical aria-hidden="true" />
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            align="end"
                            className="z-40 w-44 rounded-xl border bg-card p-1 shadow-lg"
                          >
                            <DropdownMenu.Item
                              onSelect={() => setDeleting(d)}
                              className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-destructive outline-none data-highlighted:bg-danger-soft"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              {t('delete')}
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="rounded-full bg-muted px-2.5 py-0.5">{t(`source.${d.source}`)}</span>
                      <span className="rounded-full bg-muted px-2.5 py-0.5">
                        {t('words', {count: format.number(d.wordCount)})}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                      {t('created', {
                        date: format.dateTime(new Date(d.createdAt), {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }),
                      })}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <NewDocumentDialog open={creating} onOpenChange={setCreating} />

      <AlertDialog.Root open={deleting !== null} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-card p-6 shadow-2xl">
            <AlertDialog.Title className="text-lg font-semibold">{t('confirmTitle')}</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              {t('confirmBody', {title: deleting?.title ?? ''})}
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
                  onClick={() => deleting && remove(deleting)}
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
