'use client';

import {
  CERTIFICATIONS,
  CreateAttemptResponseSchema,
  GetTestResponseSchema,
  type CandidateTest,
  type CertificationId,
} from '@linmaster/shared';
import {ArrowLeft, CircleAlert, Headphones, Play, Volume2} from 'lucide-react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {toast} from 'sonner';

import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';
import {useSession} from '@/core/auth/session-provider';

import {SKILL_NAME, preExamSteps, questionCount, type PreExamStep} from './intro-logic';

/**
 * Screens before the exam room, like the computer-based test (`/tests/[id]/start`): confirm details, sound check
 * (Listening with audio), instructions. The attempt, and so the clock, starts only on "Start test".
 * Exam text stays in English like the real test.
 */
export function PreExam({testId}: {testId: string}) {
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const {user} = useSession();
  const [test, setTest] = useState<CandidateTest | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [step, setStep] = useState(0);
  const [starting, setStarting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    api(`/tests/${testId}`)
      .then(res => setTest(GetTestResponseSchema.parse(res).test))
      .catch(setError);
  }, [testId]);

  // Each screen is a new page for screen readers: move focus to its title.
  useEffect(() => {
    if (step > 0) heading.current?.focus();
  }, [step]);

  async function start() {
    setStarting(true);
    try {
      // Returns the attempt in progress instead when there is one.
      const {attempt} = CreateAttemptResponseSchema.parse(await api('/attempts', {method: 'POST', body: {testId}}));
      router.replace(`/exam/${attempt.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setStarting(false);
    }
  }

  const backLink = (
    <Link
      href={`/tests/${testId}`}
      className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:underline"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      Back to test details
    </Link>
  );

  if (error) {
    return (
      <main className="flex h-dvh items-center justify-center p-4">
        <EmptyState
          icon={CircleAlert}
          title="This test cannot be opened"
          description={errorMessage(error)}
          action={backLink}
        />
      </main>
    );
  }
  if (!test) {
    return (
      <main className="flex h-dvh items-center justify-center p-4">
        <p role="status" className="text-sm text-muted-foreground">
          Loading the test…
        </p>
      </main>
    );
  }

  const steps = preExamSteps(test);
  const current: PreExamStep = steps[step];
  const certification = CERTIFICATIONS[test.certification as CertificationId];
  const next = () => setStep(s => s + 1);

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
        <p className="truncate text-sm font-semibold">{test.title}</p>
        <p className="shrink-0 text-xs text-muted-foreground">
          Step {step + 1} of {steps.length}
        </p>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {current === 'details' && (
            <>
              <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
                Confirm your details
              </h1>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border p-5">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-semibold">{user?.displayName ?? '…'}</dd>
                <dt className="text-muted-foreground">Test</dt>
                <dd className="font-semibold">{test.title}</dd>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-semibold">
                  {certification?.name ?? test.certification} ·{' '}
                  {test.sections.map(s => SKILL_NAME[s.skill]).join(' and ')}
                </dd>
              </dl>
              <p className="text-sm text-muted-foreground">
                If your name is not correct, change it in your{' '}
                <Link href="/profile" className="text-primary underline">
                  profile
                </Link>{' '}
                before you start.
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {backLink}
                <Button className="h-11 px-6" onClick={next}>
                  My details are correct
                </Button>
              </div>
            </>
          )}

          {current === 'sound' && (
            <>
              <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
                Test your sound
              </h1>
              <SoundCheck />
              <div className="flex justify-end">
                <Button className="h-11 px-6" onClick={next}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {current === 'instructions' && (
            <>
              <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
                Instructions to candidates
              </h1>
              {test.sections.map(section => {
                const spec = certification?.sections[section.skill];
                return (
                  <section key={section.id} className="flex flex-col gap-3 rounded-lg border p-5">
                    <h2 className="text-lg font-bold">
                      {certification?.name} {SKILL_NAME[section.skill]}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Time: {Math.round(section.durationSec / 60)} minutes · {questionCount(section)} questions ·{' '}
                      {section.passages.length} parts
                    </p>
                    <ul className="flex list-disc flex-col gap-1.5 pl-5">
                      <li>Answer all the questions.</li>
                      <li>You can change your answers at any time during the test.</li>
                      {section.skill === 'listening' ? (
                        <>
                          <li>You will hear each part once only. The recording cannot be paused or replayed.</li>
                          {!!spec?.reviewSec && (
                            <li>At the end you have {spec.reviewSec / 60} minutes to check your answers.</li>
                          )}
                        </>
                      ) : (
                        <li>Select text in a passage and right-click to highlight it or add a note.</li>
                      )}
                      <li>Each question carries one mark.</li>
                    </ul>
                  </section>
                );
              })}
              <p className="text-sm">
                The clock starts when you click <strong>Start test</strong> and keeps running even if you close the
                page. When the time is up, your answers are submitted.
              </p>
              <div className="flex justify-end">
                <Button className="h-11 px-6" onClick={start} disabled={starting}>
                  {starting ? 'Starting…' : 'Start test'}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** A short tone made in the browser, so the check needs no audio file. */
function SoundCheck() {
  const [volume, setVolume] = useState(0.7);
  const [playing, setPlaying] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);

  useEffect(() => () => void context.current?.close(), []);
  useEffect(() => {
    if (gain.current) gain.current.gain.value = volume;
  }, [volume]);

  function play() {
    // Not `disabled`: that would drop keyboard focus while the tone plays.
    if (playing) return;
    context.current ??= new AudioContext();
    const ctx = context.current;
    gain.current = ctx.createGain();
    gain.current.gain.value = volume;
    gain.current.connect(ctx.destination);
    // Three notes over two seconds.
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      osc.connect(gain.current!);
      osc.start(ctx.currentTime + i * 0.7);
      osc.stop(ctx.currentTime + i * 0.7 + 0.6);
      if (i === 2) osc.onended = () => setPlaying(false);
    });
    setPlaying(true);
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border p-5">
      <p className="flex gap-2">
        <Headphones className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        Put on your headphones and click Play sound. Change the volume until you can hear the sound clearly.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" className="h-11 px-5" onClick={play} aria-disabled={playing}>
          <Play aria-hidden="true" />
          {playing ? 'Playing…' : 'Play sound'}
        </Button>
        <label className="flex min-w-0 flex-1 items-center gap-3">
          <Volume2 className="size-5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="h-11 min-w-0 flex-1 accent-primary"
          />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        If you cannot hear the sound, check your headphones and the volume of your device.
      </p>
    </div>
  );
}
