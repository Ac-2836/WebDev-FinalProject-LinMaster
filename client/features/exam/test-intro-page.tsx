'use client';

import {
  CERTIFICATIONS,
  GetTestResponseSchema,
  ListAttemptsResponseSchema,
  type AttemptSummary,
  type CandidateTest,
  type CertificationId,
} from '@linmaster/shared';
import {ArrowLeft, Check, ClipboardCheck, CloudOff, RotateCw} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useCallback, useEffect, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {Skeleton} from '@/components/ui/skeleton';
import {api, isNotFound} from '@/core/api/client';

import {SKILL_NAME, attemptsOf, formatScores, perSection, questionCount} from './intro-logic';

const card = 'rounded-[20px] border bg-card shadow-soft';
const badge =
  'inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground';

interface Loaded {
  test: CandidateTest;
  inProgress: AttemptSummary | null;
  submitted: AttemptSummary[];
  /** Device time when loaded, for "N minutes left" (the room itself uses the server clock). */
  loadedAt: number;
}

/**
 * `/tests/[id]` (wireframe 05-exam/test-intro): what the test holds, then Start, or Continue an attempt in progress.
 * `publish`: Publish / Unpublish from the library, given by the route (a feature does not import another).
 */
export function TestIntroPage({id, publish}: {id: string; publish?: React.ReactNode}) {
  const t = useTranslations('exam.intro');
  const format = useFormatter();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<'notFound' | 'failed' | null>(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    Promise.all([api(`/tests/${id}`), api('/attempts')])
      .then(([testRes, attemptsRes]) =>
        setData({
          test: GetTestResponseSchema.parse(testRes).test,
          ...attemptsOf(ListAttemptsResponseSchema.parse(attemptsRes).attempts, id),
          loadedAt: Date.now(),
        }),
      )
      .catch(err => setError(isNotFound(err) ? 'notFound' : 'failed'));
  }, [id]);
  useEffect(load, [load]);

  const back = (
    <Link
      href="/tests"
      className="inline-flex min-h-11 w-fit items-center gap-1 text-[13px] text-muted-foreground hover:underline"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {t('back')}
    </Link>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        {error === 'notFound' ? (
          <EmptyState icon={ClipboardCheck} title={t('notFoundTitle')} description={t('notFoundBody')} />
        ) : (
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
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
        {back}
        <Skeleton className="h-8 w-1/2" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-[20px]" />
      </div>
    );
  }

  const {test, inProgress, submitted, loadedAt} = data;
  const hasListening = test.sections.some(s => s.skill === 'listening');
  const certification = CERTIFICATIONS[test.certification as CertificationId]?.name ?? test.certification;
  const last = submitted[0];
  const stats = [
    {label: t('sections'), value: test.sections.map(s => SKILL_NAME[s.skill]).join(' → ')},
    {label: t('questions'), value: perSection(test, questionCount)},
    {label: t('time'), value: t('minutes', {value: perSection(test, s => Math.round(s.durationSec / 60))})},
    {label: t('lastAttempt'), value: last ? formatScores(last.scores) : '—'},
  ];
  const notes = ['fullScreen', ...(hasListening ? ['audio'] : []), 'clock', 'autosave', 'device'] as const;
  const dateTime = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        {back}
        <div className="flex flex-wrap gap-2">
          <span className={badge}>{certification}</span>
          <span className={badge}>{t(`kind.${test.kind}`)}</span>
        </div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] break-words sm:text-[34px]">
          {test.title}
        </h1>
        {test.source && <p className="text-muted-foreground">{t('source', {source: test.source})}</p>}
      </header>
      {publish}

      <section aria-label={t('info')} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className={cn(card, 'p-4')}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-semibold">{s.value}</p>
          </div>
        ))}
      </section>

      {inProgress ? (
        <section aria-labelledby="in-progress" className={cn(card, 'flex flex-col gap-3 border-primary p-5')}>
          <h2 id="in-progress" className="text-xl font-semibold">
            {t('inProgressTitle')}
          </h2>
          <p className="text-muted-foreground">
            {t('inProgressBody', {
              startedAt: dateTime(inProgress.startedAt),
              minutes: Math.max(0, Math.ceil((Date.parse(inProgress.deadlineAt) - loadedAt) / 60_000)),
            })}
          </p>
          <Button asChild className="h-11 w-full rounded-full px-6 sm:w-fit">
            <Link href={`/exam/${inProgress.id}`}>{t('continue')}</Link>
          </Button>
        </section>
      ) : (
        <section aria-labelledby="before-start" className={cn(card, 'flex flex-col gap-4 p-5')}>
          <h2 id="before-start" className="text-xl font-semibold">
            {t('beforeTitle')}
          </h2>
          <ul className="flex flex-col gap-2">
            {notes.map(n => (
              <li key={n} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {t(`notes.${n}`)}
              </li>
            ))}
          </ul>
          <Button asChild className="h-11 w-full rounded-full px-6 sm:w-fit">
            <Link href={`/tests/${test.id}/start`}>{t('start')}</Link>
          </Button>
        </section>
      )}

      {submitted.length > 0 && (
        <section aria-labelledby="past-attempts">
          <h2 id="past-attempts" className="mb-3 text-xl font-semibold">
            {t('pastTitle')}
          </h2>
          <ul className={cn(card, 'divide-y')}>
            {submitted.map(a => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                <span className="flex-1">{dateTime(a.startedAt)}</span>
                <span className="font-semibold">{formatScores(a.scores)}</span>
                <Link
                  href={`/attempts/${a.id}/result`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
                >
                  {t('seeResult')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
