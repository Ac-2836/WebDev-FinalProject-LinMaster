'use client';

import {GetAttemptResponseSchema, type Attempt} from '@linmaster/shared';
import {CircleAlert, CircleCheck} from 'lucide-react';
import Link from 'next/link';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {toast} from 'sonner';

import {buttonVariants} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';
import {HOME_PATH} from '@/core/auth/redirect';
import {useSession} from '@/core/auth/session-provider';

import {
  answeredNumbers,
  currentSectionOf,
  flaggedNumbers,
  questionIndex,
  sectionParts,
  startQuestion,
  toggleFlag,
} from './attempt-logic';
import {ExamRoom} from './exam-room';
import {useAutosave} from './room-hooks';
import {partOf} from './room-logic';

/**
 * Exam room of one attempt (`/exam/[attemptId]`): loads it from the server, which also submits it when the time
 * ran out (lazy submit), then runs the section in progress. Everything lives in the attempt, so a refresh
 * reopens the same place with the same time left.
 */
export function AttemptRoom({attemptId}: {attemptId: string}) {
  const errorMessage = useErrorMessage();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      api<unknown>(`/attempts/${attemptId}`)
        .then(res => setAttempt(GetAttemptResponseSchema.parse(res).attempt))
        .catch(setError),
    [attemptId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Centered>
        <EmptyState
          icon={CircleAlert}
          title="This test cannot be opened"
          description={errorMessage(error)}
          action={<HomeLink />}
        />
      </Centered>
    );
  }
  if (!attempt) {
    return (
      <Centered>
        <p role="status" className="text-sm text-muted-foreground">
          Loading the test…
        </p>
      </Centered>
    );
  }
  if (attempt.status === 'submitted') {
    return (
      <Centered>
        <EmptyState
          icon={CircleCheck}
          title={attempt.autoSubmitted ? 'Time is up' : 'Test submitted'}
          description="Your answers have been submitted."
          action={<HomeLink />}
        />
      </Centered>
    );
  }
  // A Full test moving from Listening to Reading starts the room again on the new section.
  return <RunningAttempt key={attempt.currentSectionId} attempt={attempt} reload={load} />;
}

function RunningAttempt({attempt, reload}: {attempt: Attempt; reload: () => Promise<void>}) {
  const {user} = useSession();
  const errorMessage = useErrorMessage();
  const section = currentSectionOf(attempt)!;
  const parts = useMemo(() => sectionParts(section), [section]);
  const {idOf, numberOf} = useMemo(() => questionIndex(section), [section]);
  const [state, setState] = useState(attempt.state);
  const [current, setCurrent] = useState(() => startQuestion(attempt.state, section, parts));
  const [submitting, setSubmitting] = useState(false);
  const {saveState, flush} = useAutosave(attempt.id, state, reload);

  const sectionTime = attempt.sections.find(s => s.sectionId === section.id);
  const isLastSection = attempt.sections.at(-1)?.sectionId === section.id;

  function navigate(n: number) {
    setCurrent(n);
    setState(s => ({...s, position: {sectionId: section.id, questionId: idOf.get(n) ?? null}}));
  }

  async function submit() {
    setSubmitting(true);
    try {
      // The last answers must be saved first, or they are not graded.
      if (!(await flush())) {
        toast.error('Your last answers are not saved yet. Check your connection and submit again.');
        setSubmitting(false);
        return;
      }
      await api(`/attempts/${attempt.id}/submit`, {method: 'POST'});
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
      setSubmitting(false);
    }
  }

  async function expire() {
    if (!isLastSection) {
      await flush();
      await reload();
    } else await submit();
  }

  const part = partOf(parts, current);
  const passage = section.passages.find(p => p.id === part?.id);
  const group = passage?.groups.find(g => g.fromNo <= current && current <= g.toNo);
  const question = group?.questions.find(q => q.number === current);
  const skill = section.skill === 'listening' ? 'Listening' : 'Reading';

  return (
    <ExamRoom
      candidateName={user?.displayName ?? ''}
      testTitle={`${attempt.test.title} · ${skill}`}
      deadlineAt={sectionTime?.endsAt ?? attempt.deadlineAt}
      serverNow={attempt.serverNow}
      onExpire={() => void expire()}
      onSubmit={() => void submit()}
      saveState={saveState}
      submitted={submitting}
      parts={parts}
      current={current}
      answered={answeredNumbers(state, numberOf)}
      flagged={flaggedNumbers(state, numberOf)}
      onNavigate={navigate}
      onToggleReview={n => {
        const id = idOf.get(n);
        if (id) setState(s => toggleFlag(s, id));
      }}
      partBar={
        part && (
          <>
            <strong>{part.title}</strong>&nbsp;{' '}
            {section.skill === 'listening' ? 'Listen and answer' : 'Read the text and answer'} questions{' '}
            {part.questions[0]}–{part.questions.at(-1)}.
          </>
        )
      }
    >
      {/* shortcut: read-only view of the current question until the Reading (P3-13) and Listening (P3-14) views mount here. */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-8">
        {passage && <h1 className="text-[1.3em] font-bold">{passage.title}</h1>}
        {group && <p className="mt-4 font-semibold whitespace-pre-line">{group.instructions}</p>}
        {question && (
          <p className="mt-4">
            <strong>{question.number}.</strong> {question.prompt.replace('{{blank}}', '______')}
          </p>
        )}
      </div>
    </ExamRoom>
  );
}

function Centered({children}: {children: React.ReactNode}) {
  return <main className="flex h-dvh items-center justify-center p-4">{children}</main>;
}

function HomeLink() {
  return (
    <Link href={HOME_PATH} className={buttonVariants({className: 'h-11'})}>
      Back to home
    </Link>
  );
}
