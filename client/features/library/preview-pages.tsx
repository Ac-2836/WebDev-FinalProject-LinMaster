'use client';

import {
  CERTIFICATIONS,
  LibraryCopyResponseSchema,
  LibrarySetPreviewResponseSchema,
  LibraryTestPreviewResponseSchema,
  type CertificationId,
  type LibrarySetPreviewResponse,
  type LibraryTestPreviewResponse,
} from '@linmaster/shared';
import {ArrowLeft, Check, CircleCheck, CloudOff, Copy, CopyPlus, Flag, Lock, RotateCw, SearchX} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useCallback, useEffect, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button, buttonVariants} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {Skeleton} from '@/components/ui/skeleton';
import {api, isNotFound} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {libraryStatus} from './library-logic';
import {Author, badge, card, skillsLabel} from './library-page';
import {ReportDialog} from './report-dialog';

/** Loads one preview; private, hidden or deleted content answers 404 (C5). */
function usePreview<T>(path: string, schema: {parse: (res: unknown) => T}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<'notFound' | 'failed' | null>(null);
  const load = useCallback(() => {
    setError(null);
    setData(null);
    api(path)
      .then(res => setData(schema.parse(res)))
      .catch(err => setError(isNotFound(err) ? 'notFound' : 'failed'));
  }, [path, schema]);
  useEffect(load, [load]);
  return {data, setData, error, retry: load};
}

function BackLink() {
  const t = useTranslations('library.preview');
  return (
    <Link
      href="/library"
      className="inline-flex min-h-11 w-fit items-center gap-1 text-[13px] text-muted-foreground hover:underline"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {t('back')}
    </Link>
  );
}

function PreviewState({error, retry}: {error: 'notFound' | 'failed' | null; retry: () => void}) {
  const t = useTranslations('library.preview');
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <BackLink />
      {error === 'notFound' ? (
        <EmptyState icon={SearchX} title={t('notFoundTitle')} description={t('notFoundBody')} />
      ) : error ? (
        <EmptyState
          icon={CloudOff}
          title={t('loadError')}
          action={
            <Button variant="outline" onClick={retry}>
              <RotateCw className="size-4" aria-hidden="true" />
              {t('retry')}
            </Button>
          }
        />
      ) : (
        <div role="status" aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only">{t('loading')}</span>
          <Skeleton className="h-28 rounded-[20px]" />
          <Skeleton className="h-64 rounded-[20px]" />
        </div>
      )}
    </div>
  );
}

function ReportButton({reported, onClick, label}: {reported: boolean; onClick: () => void; label: string}) {
  const t = useTranslations('library.preview');
  return (
    // aria-disabled, not disabled: the dialog returns focus here after a report, so the button must stay focusable.
    <Button
      variant="ghost"
      className="h-11 aria-disabled:opacity-60"
      aria-disabled={reported}
      onClick={() => !reported && onClick()}
    >
      <Flag className="size-4" aria-hidden="true" />
      {reported ? t('reported') : label}
    </Button>
  );
}

/** `/library/sets/[id]` (wireframe 06-library/set-preview): every card, copy to my library, report. */
export function SetPreviewPage({id}: {id: string}) {
  const t = useTranslations('library.preview');
  const errors = useTranslations('library.errors');
  const errorMessage = useErrorMessage();
  const format = useFormatter();
  const {data, setData, error, retry} = usePreview(`/library/sets/${id}`, LibrarySetPreviewResponseSchema);
  const [copying, setCopying] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [reporting, setReporting] = useState(false);

  if (!data) return <PreviewState error={error} retry={retry} />;
  const {set, viewer} = data;
  const update = (patch: Partial<LibrarySetPreviewResponse['viewer']>, copies = 0) =>
    setData({set: {...set, copyCount: set.copyCount + copies}, viewer: {...viewer, ...patch}});

  async function copy() {
    setCopying(true);
    try {
      const {setId} = LibraryCopyResponseSchema.parse(await api(`/library/sets/${id}/copy`, {method: 'POST'}));
      update({copiedSetId: setId}, 1);
      setJustCopied(true);
    } catch (err) {
      const status = libraryStatus(err);
      toast.error(status ? errors(status) : errorMessage(err));
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <BackLink />
      <header className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <span className={badge}>
            {set.termLang.toUpperCase()} → {set.definitionLang.toUpperCase()}
          </span>
          <h1 className="mt-2 text-3xl font-bold break-words">{set.title}</h1>
          {set.description && <p className="mt-1 text-muted-foreground">{set.description}</p>}
          <div className="mt-3">
            <Author name={set.author.displayName}>
              <span className="text-muted-foreground">
                · {t('published', {date: format.dateTime(new Date(set.publishedAt), {dateStyle: 'short'})})} ·{' '}
                {t('copies', {count: set.copyCount})}
              </span>
            </Author>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {viewer.isOwner ? (
            <Link href={`/flashcards/${set.id}`} className={buttonVariants({className: 'h-11 flex-1 sm:flex-none'})}>
              {t('openMine')}
            </Link>
          ) : viewer.copiedSetId ? (
            <Link
              href={`/flashcards/${viewer.copiedSetId}`}
              className={buttonVariants({className: 'h-11 flex-1 sm:flex-none'})}
            >
              <Check className="size-4" aria-hidden="true" />
              {t('copiedOpen')}
            </Link>
          ) : (
            <Button className="h-11 flex-1 sm:flex-none" disabled={copying} onClick={() => void copy()}>
              <CopyPlus className="size-4" aria-hidden="true" />
              {t('copy')}
            </Button>
          )}
          {!viewer.isOwner && (
            <ReportButton reported={viewer.reported} onClick={() => setReporting(true)} label={t('reportSet')} />
          )}
        </div>
      </header>
      {justCopied && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-success-soft p-3 text-sm text-success">
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          {t('copiedBody', {count: set.cards.length})}
        </p>
      )}
      {viewer.copiedSetId && !justCopied && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Copy className="size-4" aria-hidden="true" />
          {t('copiedBefore')}
        </p>
      )}

      <section aria-labelledby="preview-cards" className="flex flex-col gap-3">
        <h2 id="preview-cards" className="text-xl font-bold">
          {t('cards', {count: set.cards.length})}
        </h2>
        <ul className={cn(card, 'divide-y')}>
          {set.cards.map(c => (
            <li key={c.id} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
              <span className="font-semibold break-words">{c.term}</span>
              <span className="break-words">
                {c.definition}
                {c.example && <span className="mt-1 block text-sm text-muted-foreground italic">{c.example}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ReportDialog
        type="set"
        id={set.id}
        open={reporting}
        onOpenChange={setReporting}
        onReported={() => update({reported: true})}
      />
    </div>
  );
}

/** `/library/tests/[id]` (wireframe 06-library/test-preview): facts about the test, never its questions or answers. */
export function TestPreviewPage({id}: {id: string}) {
  const t = useTranslations('library.preview');
  const kinds = useTranslations('exam.result.kinds');
  const format = useFormatter();
  const {data, setData, error, retry} = usePreview(`/library/tests/${id}`, LibraryTestPreviewResponseSchema);
  const [reporting, setReporting] = useState(false);

  if (!data) return <PreviewState error={error} retry={retry} />;
  const {test, viewer} = data;
  const update = (patch: Partial<LibraryTestPreviewResponse['viewer']>) =>
    setData({test, viewer: {...viewer, ...patch}});
  const stats = [
    [t('skill'), skillsLabel(test.skills)],
    [t('questions'), String(test.questionCount)],
    [t('duration'), t('minutes', {count: Math.round(test.durationSec / 60)})],
    [t('attemptsLabel'), format.number(test.attemptCount, {notation: 'compact'})],
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <BackLink />
      <header className="flex flex-col gap-2">
        <span className={cn(badge, 'w-fit')}>
          {CERTIFICATIONS[test.certification as CertificationId]?.name ?? test.certification}
        </span>
        <h1 className="text-3xl font-bold break-words">{test.title}</h1>
        <Author name={test.author.displayName}>
          <span className="text-muted-foreground">
            · {t('published', {date: format.dateTime(new Date(test.publishedAt), {dateStyle: 'short'})})} ·{' '}
            {t('attempts', {count: test.attemptCount})}
            {test.source && ` · ${t('source', {source: test.source})}`}
          </span>
        </Author>
      </header>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className={cn(card, 'flex flex-col p-4')}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="preview-kinds" className={cn(card, 'flex flex-col gap-3 p-5')}>
        <h2 id="preview-kinds" className="text-lg font-bold">
          {t('kinds')}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {test.questionKinds.map(k => (
            <li key={k} className={badge}>
              {kinds(k)}
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          {t('hiddenQuestions')}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href={`/tests/${test.id}/start`} className={buttonVariants({className: 'h-11 px-6'})}>
          {t('take')}
        </Link>
        {!viewer.isOwner && (
          <ReportButton reported={viewer.reported} onClick={() => setReporting(true)} label={t('report')} />
        )}
      </div>

      <ReportDialog
        type="test"
        id={test.id}
        open={reporting}
        onOpenChange={setReporting}
        onReported={() => update({reported: true})}
      />
    </div>
  );
}
