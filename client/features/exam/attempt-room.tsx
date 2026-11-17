'use client';

import {CERTIFICATIONS, GetAttemptResponseSchema, type Attempt, type CertificationId} from '@linmaster/shared';
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
  answersByNumber,
  currentSectionOf,
  flaggedNumbers,
  passageMarks,
  questionIndex,
  sectionParts,
  setAnswers,
  setPassageMarks,
  startQuestion,
  toggleFlag,
} from './attempt-logic';
import {ExamRoom} from './exam-room';
import {ListeningRoom} from './listening/listening-room';
import {toggleStruck, type Struck} from './reading/reading-logic';
import {ReadingRoom} from './reading/reading-room';
import {OtherTabDialog} from './room-dialogs';
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
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href={`/attempts/${attempt.id}/result`} className={buttonVariants({className: 'h-11'})}>
                See your result
              </Link>
              <HomeLink />
            </div>
          }
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
  const {saveState, flush, blocked, takeOver} = useAutosave(attempt.id, state, reload);
  // Crossed-out options are a reading aid, not part of the saved attempt: they stay on this device.
  const struckKey = `lm_struck_${attempt.id}_${section.id}`;
  const [struck, setStruck] = useState<Struck>(() => {
    try {
      return JSON.parse(localStorage.getItem(struckKey) ?? '{}') as Struck;
    } catch {
      return {};
    }
  });

  const sectionTime = attempt.sections.find(s => s.sectionId === section.id);
  const isLastSection = attempt.sections.at(-1)?.sectionId === section.id;

  function navigate(n: number) {
    setCurrent(n);
    setState(s => ({...s, position: {sectionId: section.id, questionId: idOf.get(n) ?? null}}));
  }

  function strike(question: number, key: string) {
    const next = toggleStruck(struck, question, key);
    setStruck(next);
    try {
      localStorage.setItem(struckKey, JSON.stringify(next));
    } catch {
      // Private mode: crossed-out options last for this page only.
    }
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
  const certification = CERTIFICATIONS[attempt.test.certification as CertificationId];
  const skill = section.skill === 'listening' ? 'Listening' : 'Reading';

  return (
    <>
      {blocked && <OtherTabDialog onTakeOver={takeOver} />}
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
        {section.skill === 'reading' && passage ? (
          <ReadingRoom
            passage={passage}
            answers={answersByNumber(state, numberOf)}
            onAnswer={patch => setState(s => setAnswers(s, patch, idOf))}
            highlights={passageMarks(state, passage.id)}
            onHighlightsChange={marks => setState(s => setPassageMarks(s, passage.id, marks))}
            struck={struck}
            onStrike={strike}
            current={current}
            onCurrentChange={navigate}
          />
        ) : (
          passage && (
            <ListeningRoom
              audio={attempt.audio?.sectionId === section.id ? attempt.audio : null}
              passage={passage}
              reviewMinutes={(certification?.sections.listening.reviewSec ?? 0) / 60}
              answers={answersByNumber(state, numberOf)}
              onAnswer={patch => setState(s => setAnswers(s, patch, idOf))}
              struck={struck}
              onStrike={strike}
              current={current}
              onCurrentChange={navigate}
            />
          )
        )}
      </ExamRoom>
    </>
  );
}

function Centered({children}: {children: React.ReactNode}) {
  return <main className="flex h-dvh items-center justify-center p-4">{children}</main>;
}

function HomeLink() {
  return (
    <Link href={HOME_PATH} className={buttonVariants({variant: 'outline', className: 'h-11'})}>
      Back to home
    </Link>
  );
}
