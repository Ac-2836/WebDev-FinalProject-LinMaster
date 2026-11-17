'use client';

import {
  CreateVocabDocumentResponseSchema,
  GetAttemptResultResponseSchema,
  GetTestResponseSchema,
  type AttemptResult,
  type CandidateTest,
  type QuestionExplanation,
  type ResultQuestion,
  type ResultTranscript,
  type Skill,
} from '@linmaster/shared';
import {ArrowLeft, BookOpenText, CircleAlert, CloudOff, FileText, LoaderCircle, RotateCw, X} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Dialog, Tabs} from 'radix-ui';
import {useCallback, useEffect, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {Skeleton} from '@/components/ui/skeleton';
import {api, ApiError, isNotFound} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';
import {useSession} from '@/core/auth/session-provider';

import {explainKey} from './explain-logic';
import {ExplainPanel} from './explain-panel';
import {SKILL_NAME} from './intro-logic';
import {useReturnFocus} from './room-dialogs';
import {givenText, kindAccuracy, minutesBetween, overallBand} from './result-logic';

const card = 'rounded-[20px] border bg-card shadow-soft';
const tabClass =
  'flex min-h-11 flex-1 items-center justify-center rounded-md px-4 py-1.5 font-semibold whitespace-nowrap text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm';
const drawerClass = 'fixed inset-y-0 right-0 z-50 flex w-[min(28rem,100vw)] flex-col bg-card shadow-2xl outline-none';

interface Loaded {
  result: AttemptResult;
  /** The candidate view of the test, for the Reading passages; null when it was deleted. */
  test: CandidateTest | null;
}

/**
 * `/attempts/[id]/result` (wireframe 05-exam/result): bands per skill, every question with the learner's answer and
 * the key, explanations from the test file, Listening transcripts, and "open the passage in the Reader".
 */
export function ResultPage({attemptId}: {attemptId: string}) {
  const t = useTranslations('exam.result');
  const format = useFormatter();
  const {user} = useSession();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<'notFound' | 'notSubmitted' | 'failed' | null>(null);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [explaining, setExplaining] = useState<ResultQuestion | null>(null);
  const [transcript, setTranscript] = useState<ResultTranscript | null>(null);
  // AI explanations already fetched, so reopening a question (or clicking again) does not call the model again.
  const [explained, setExplained] = useState<Record<string, QuestionExplanation>>({});

  const load = useCallback(() => {
    setError(null);
    setData(null);
    api(`/attempts/${attemptId}/result`)
      .then(async res => {
        const result = GetAttemptResultResponseSchema.parse(res).result;
        const test = await api(`/tests/${result.testId}`)
          .then(r => GetTestResponseSchema.parse(r).test)
          .catch(() => null);
        setData({result, test});
      })
      .catch(err =>
        setError(
          err instanceof ApiError && err.status === 'ATTEMPT_NOT_SUBMITTED'
            ? 'notSubmitted'
            : isNotFound(err)
              ? 'notFound'
              : 'failed',
        ),
      );
  }, [attemptId]);
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
        {error === 'failed' ? (
          <div role="alert" className={cn(card, 'flex flex-col items-center gap-3 p-10 text-center')}>
            <CloudOff className="size-6 text-destructive" aria-hidden="true" />
            <p className="font-bold">{t('loadError')}</p>
            <Button variant="outline" className="h-10 rounded-full" onClick={load}>
              <RotateCw aria-hidden="true" />
              {t('retry')}
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={CircleAlert}
            title={t(`${error}Title`)}
            description={t(`${error}Body`)}
            action={
              error === 'notSubmitted' && (
                <Button asChild className="h-11 rounded-full px-5">
                  <Link href={`/exam/${attemptId}`}>{t('continue')}</Link>
                </Button>
              )
            }
          />
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
        {back}
        <Skeleton className="h-8 w-1/2" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-28 rounded-[20px]" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-[20px]" />
      </div>
    );
  }

  const {result, test} = data;
  const overall = overallBand(result.scores);
  const skills = result.scores.map(s => s.skill);
  const readingPassages = test?.sections.filter(s => s.skill === 'reading').flatMap(s => s.passages) ?? [];
  const submittedAt = result.submittedAt ?? result.startedAt;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        {back}
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] break-words sm:text-[34px]">
          {t('title', {title: result.testTitle})}
        </h1>
        <p className="text-muted-foreground">
          {t('submitted', {
            at: format.dateTime(new Date(submittedAt), {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            }),
            minutes: minutesBetween(result.startedAt, submittedAt),
          })}
          {result.autoSubmitted && ` · ${t('autoSubmitted')}`}
        </p>
      </header>

      <section aria-label={t('scores')} className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {result.scores.length > 1 && overall !== null && (
          <div className={cn(card, 'col-span-2 flex flex-col gap-1 p-5 md:col-span-1')}>
            <p className="text-sm text-muted-foreground">{t('overall')}</p>
            <p className="text-4xl font-bold text-primary">{overall.toFixed(1)}</p>
            {user?.targetBand && (
              <p className="text-sm text-muted-foreground">{t('target', {band: user.targetBand.toFixed(1)})}</p>
            )}
          </div>
        )}
        {result.scores.map(s => (
          <div key={s.skill} className={cn(card, 'flex flex-col gap-1 p-5')}>
            <p className="text-sm text-muted-foreground">{SKILL_NAME[s.skill]}</p>
            <p className="text-3xl font-bold">{s.band.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">{t('correct', {correct: s.correct, total: s.total})}</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary"
                style={{width: `${(s.correct / Math.max(1, s.total)) * 100}%`}}
              />
            </div>
            {result.scores.length === 1 && user?.targetBand && (
              <p className="text-sm text-muted-foreground">{t('target', {band: user.targetBand.toFixed(1)})}</p>
            )}
          </div>
        ))}
      </section>

      {readingPassages.length > 0 && (
        <section className={cn(card, 'flex flex-col gap-3 p-5')}>
          <div>
            <h2 className="font-semibold">{t('readerTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('readerBody')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {readingPassages.map(p => (
              <OpenInReader key={p.id} attemptId={attemptId} passageId={p.id} label={t('passage', {n: p.position})} />
            ))}
          </div>
        </section>
      )}

      {result.transcripts.length > 0 && (
        <section className={cn(card, 'flex flex-col gap-3 p-5')}>
          <div>
            <h2 className="font-semibold">{t('transcriptTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('transcriptBody')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.transcripts.map(tr => (
              <Button
                key={tr.passageId}
                variant="outline"
                className="h-11 rounded-full px-4"
                onClick={() => setTranscript(tr)}
              >
                <FileText aria-hidden="true" />
                {tr.title}
              </Button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="result-questions" className={cn(card, 'flex flex-col gap-4 p-5')}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="result-questions" className="flex-1 text-xl font-semibold">
            {t('questions')}
          </h2>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={wrongOnly}
              onChange={e => setWrongOnly(e.target.checked)}
            />
            {t('wrongOnly', {count: result.questions.filter(q => !q.isCorrect).length})}
          </label>
        </div>
        <Tabs.Root defaultValue={skills[0] ?? 'reading'} className="flex flex-col gap-3">
          {skills.length > 1 && (
            <Tabs.List
              className="inline-flex w-full rounded-lg border bg-muted p-0.5 text-sm sm:w-fit"
              aria-label={t('skill')}
            >
              {skills.map(s => (
                <Tabs.Trigger key={s} value={s} className={tabClass}>
                  {SKILL_NAME[s]}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          )}
          {(skills.length ? skills : (['reading'] as Skill[])).map(skill => (
            <Tabs.Content key={skill} value={skill}>
              <QuestionTable
                questions={result.questions.filter(q => q.skill === skill && (!wrongOnly || !q.isCorrect))}
                onExplain={setExplaining}
              />
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </section>

      <section aria-labelledby="result-kinds" className={cn(card, 'flex flex-col gap-3 p-5')}>
        <h2 id="result-kinds" className="text-xl font-semibold">
          {t('byKind')}
        </h2>
        <ul className="flex flex-col gap-3">
          {kindAccuracy(result.questions).map(k => (
            <li key={k.kind} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
              <span>{t(`kinds.${k.kind}`)}</span>
              <span className="font-semibold tabular-nums">
                {k.percent}%{' '}
                <span className="font-normal text-muted-foreground">
                  ({k.correct}/{k.total})
                </span>
              </span>
              <span className="col-span-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary" style={{width: `${k.percent}%`}} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Drawer
        open={!!explaining}
        onClose={() => setExplaining(null)}
        title={explaining ? t('explainTitle', {n: explaining.number}) : ''}
      >
        {explaining && (
          <ExplainPanel
            attemptId={attemptId}
            question={explaining}
            test={test}
            transcripts={result.transcripts}
            cached={explained[explainKey(explaining.skill, explaining.number)]}
            onExplained={e => setExplained(prev => ({...prev, [explainKey(e.skill, e.number)]: e}))}
          />
        )}
      </Drawer>

      <Drawer open={!!transcript} onClose={() => setTranscript(null)} title={transcript?.title ?? ''}>
        {transcript && (
          <div className="flex flex-col gap-3">
            {transcript.paragraphs.map((p, i) => (
              <p key={i}>
                {p.label && <strong className="mr-1">{p.label}:</strong>}
                {p.text}
              </p>
            ))}
            <OpenInReader attemptId={attemptId} passageId={transcript.passageId} label={t('openTranscript')} />
          </div>
        )}
      </Drawer>
    </div>
  );
}

function QuestionTable({questions, onExplain}: {questions: ResultQuestion[]; onExplain: (q: ResultQuestion) => void}) {
  const t = useTranslations('exam.result');
  if (!questions.length) return <p className="py-6 text-center text-sm text-muted-foreground">{t('noWrong')}</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="sr-only sm:not-sr-only">
        <tr className="border-b text-muted-foreground">
          <th scope="col" className="py-2 pr-3 font-semibold">
            {t('colNo')}
          </th>
          <th scope="col" className="py-2 pr-3 font-semibold">
            {t('colKind')}
          </th>
          <th scope="col" className="py-2 pr-3 font-semibold">
            {t('colGiven')}
          </th>
          <th scope="col" className="py-2 pr-3 font-semibold">
            {t('colCorrect')}
          </th>
          <th scope="col" className="py-2 font-semibold">
            <span className="sr-only">{t('colExplain')}</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {questions.map(q => {
          const given = givenText(q.given);
          return (
            <tr key={q.number} className="grid grid-cols-[auto_1fr_auto] gap-x-3 py-2 sm:table-row">
              <td className="font-bold sm:py-2 sm:pr-3">
                <span
                  className={cn(
                    'inline-flex size-7 items-center justify-center rounded-md text-xs',
                    q.isCorrect ? 'bg-success-soft text-success' : 'bg-danger-soft text-destructive',
                  )}
                >
                  {q.number}
                </span>
                <span className="sr-only">{q.isCorrect ? t('right') : t('wrong')}</span>
              </td>
              <td className="text-muted-foreground sm:py-2 sm:pr-3">{t(`kinds.${q.kind}`)}</td>
              <td className="row-span-3 self-center sm:py-2">
                <Button variant="ghost" className="h-11 rounded-full px-3" onClick={() => onExplain(q)}>
                  {t('explain')}
                </Button>
              </td>
              <td className="col-start-2 sm:py-2 sm:pr-3">
                <span className="sm:sr-only">{t('colGiven')}: </span>
                {given ? (
                  <span className={cn(!q.isCorrect && 'text-destructive line-through decoration-1')}>{given}</span>
                ) : (
                  <span className="text-muted-foreground italic">{t('blank')}</span>
                )}
              </td>
              <td className="col-start-2 font-semibold sm:py-2 sm:pr-3">
                <span className="font-normal sm:sr-only">{t('colCorrect')}: </span>
                {q.correct.join(' / ')}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Makes the passage a Reader document (`POST /vocab/documents/from-exam`, the same one again if it exists). */
function OpenInReader({attemptId, passageId, label}: {attemptId: string; passageId: string; label: string}) {
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [opening, setOpening] = useState(false);
  return (
    <Button
      variant="outline"
      className="h-11 rounded-full px-4"
      disabled={opening}
      onClick={async () => {
        setOpening(true);
        try {
          const {document} = CreateVocabDocumentResponseSchema.parse(
            await api('/vocab/documents/from-exam', {method: 'POST', body: {attemptId, passageId}}),
          );
          router.push(`/read/${document.id}`);
        } catch (err) {
          toast.error(errorMessage(err));
          setOpening(false);
        }
      }}
    >
      {opening ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <BookOpenText aria-hidden="true" />}
      {label}
    </Button>
  );
}

function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('exam.result');
  return (
    <Dialog.Root open={open} onOpenChange={o => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <Dialog.Content className={drawerClass} aria-describedby={undefined} {...useReturnFocus()}>
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <Dialog.Title className="flex-1 text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="size-11" aria-label={t('close')}>
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
