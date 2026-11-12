'use client';

import {GetImportResponseSchema, ImportIssueCodeSchema, type ImportIssue, type TestImport} from '@linmaster/shared';
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CircleCheck,
  CloudOff,
  LoaderCircle,
  RotateCw,
  TriangleAlert,
} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useCallback, useEffect, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {api, ApiError} from '@/core/api/client';

import {isRunning} from './upload-logic';

const card = 'rounded-[20px] border bg-card shadow-soft';
const POLL_MS = 3000;
const STEPS = ['queued', 'parsing', 'validating'] as const;

/** `/tests/imports/[id]` (wireframe 05-exam/import-status): progress of the import job, then the test or the errors. */
export function ImportStatusPage({id}: {id: string}) {
  const t = useTranslations('exam.import');
  const [data, setData] = useState<TestImport | null>(null);
  const [error, setError] = useState<'notFound' | 'failed' | null>(null);

  const load = useCallback(
    () =>
      api(`/tests/imports/${id}`)
        .then(res => {
          setError(null);
          setData(GetImportResponseSchema.parse(res).import);
        })
        .catch(err => setError(err instanceof ApiError && [403, 404].includes(err.httpStatus) ? 'notFound' : 'failed')),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  // Ask again every few seconds while the job runs (PLAN C4 step 5).
  const running = !data || isRunning(data.status);
  useEffect(() => {
    if (!running || error) return;
    const timer = setTimeout(() => void load(), POLL_MS);
    return () => clearTimeout(timer);
  }, [data, running, error, load]);

  const back = (
    <Link
      href="/tests"
      className="inline-flex min-h-11 w-fit items-center gap-1 text-[13px] text-muted-foreground hover:underline"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {t('back')}
    </Link>
  );

  if (error === 'notFound') {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <EmptyState icon={CircleAlert} title={t('notFoundTitle')} description={t('notFoundBody')} />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <div role="alert" className={cn(card, 'flex flex-col items-center gap-3 p-10 text-center')}>
          <CloudOff className="size-6 text-destructive" aria-hidden="true" />
          <p className="font-bold">{t('loadError')}</p>
          <Button variant="outline" className="h-10 rounded-full" onClick={() => void load()}>
            <RotateCw aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      </div>
    );
  }

  const status = data?.status ?? 'queued';
  const errors = data?.errors.filter(e => e.severity === 'error') ?? [];
  const warnings = data?.errors.filter(e => e.severity === 'warning') ?? [];
  const at = status === 'done' ? STEPS.length : status === 'failed' ? STEPS.length - 1 : STEPS.indexOf(status);
  const HeadIcon = status === 'done' ? CircleCheck : status === 'failed' ? CircleAlert : LoaderCircle;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {back}
      <header className="flex items-center gap-3">
        <HeadIcon
          className={cn(
            'size-8 shrink-0',
            status === 'done' ? 'text-success' : status === 'failed' ? 'text-destructive' : 'animate-spin text-primary',
          )}
          aria-hidden="true"
        />
        <div>
          <h1 className="text-2xl font-semibold" role="status">
            {t(`heading.${status === 'done' || status === 'failed' ? status : 'running'}`)}
          </h1>
          {data && <p className="text-sm text-muted-foreground">{t('kind', {kind: data.kind})}</p>}
        </div>
      </header>

      <ol className={cn(card, 'flex flex-col gap-4 p-5')} aria-label={t('steps')}>
        {STEPS.map((step, i) => {
          const done = i < at;
          const failedHere = status === 'failed' && i === at;
          const now = i === at && isRunning(status);
          return (
            <li key={step} className="flex items-start gap-3" aria-current={now ? 'step' : undefined}>
              <span
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                  done && 'border-success bg-success text-white',
                  failedHere && 'border-destructive bg-destructive text-white',
                  now && 'border-primary text-primary',
                )}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : failedHere ? '!' : i + 1}
              </span>
              <div>
                <p className="font-semibold">
                  {t(`step.${step}`)}
                  {now && <span className="ml-2 text-sm font-normal text-primary">{t('runningNow')}</span>}
                </p>
                {failedHere && <p className="text-sm text-destructive">{t('errorCount', {count: errors.length})}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {isRunning(status) && <p className="text-sm text-muted-foreground">{t('canLeave')}</p>}

      {status === 'done' && data?.testId && (
        <section className="flex flex-col gap-4">
          {warnings.length > 0 && (
            <div className="flex gap-2 rounded-xl bg-warning-soft p-4 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p className="font-semibold">{t('warnings', {count: warnings.length})}</p>
                <ul className="mt-1 list-disc pl-5">
                  {warnings.map((w, i) => (
                    <li key={i}>
                      <IssueText issue={w} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-11 rounded-full px-5">
              <Link href={`/tests/${data.testId}`}>{t('takeNow')}</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-full px-5">
              <Link href="/tests">{t('toList')}</Link>
            </Button>
          </div>
        </section>
      )}

      {status === 'failed' && (
        <section className="flex flex-col gap-4">
          <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-destructive">
            {t('failedBody')}
          </p>
          {errors.length > 0 && (
            <div className={cn(card, 'overflow-x-auto')}>
              <table className="w-full text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      {t('colSection')}
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      {t('colQuestion')}
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      {t('colError')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {errors.map((e, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">
                        {e.section ? (e.section === 'listening' ? 'Listening' : 'Reading') : '—'}
                      </td>
                      <td className="px-4 py-2">{e.questionNo ?? '—'}</td>
                      <td className="px-4 py-2">
                        <IssueText issue={e} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button asChild className="h-11 w-fit rounded-full px-5">
            <Link href="/tests/new">{t('retryUpload')}</Link>
          </Button>
        </section>
      )}
    </div>
  );
}

/** A message per issue code; codes this client does not know yet fall back to a generic sentence. */
function IssueText({issue}: {issue: ImportIssue}) {
  const t = useTranslations('exam.import');
  const code = ImportIssueCodeSchema.safeParse(issue.code);
  return <>{code.success ? t(`issues.${code.data}`, {questionNo: issue.questionNo ?? 0}) : t('issues.unknown')}</>;
}
