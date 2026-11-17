'use client';

import {
  EXERCISE_MIN_CARDS,
  GenerateExerciseResponseSchema,
  type ExerciseKind,
  type ExerciseQuestion,
  type FlashcardSet,
} from '@linmaster/shared';
import {CircleAlert, CircleCheck, CircleX, CloudOff, Sparkles} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {inputClass} from '@/components/ui/input';
import {api, ApiError} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {grade, KIND_ORDER, ordered, splitBlank, unitsOf, withKind, type Unit} from './exercise-logic';
import {NeedMoreCards} from './match-mode';
import {StudyShell} from './study-shell';
import {useStudySession} from './study-session';

/** The server refuses the same failed request for this long (60 s); pressing again sooner would only get the same 502. */
const COOLDOWN_SECONDS = 60;
const card = 'flex flex-col gap-4 rounded-[20px] border bg-card p-6 shadow-soft';

/** Bài luyện AI (C3, wireframe 04-flashcard/exercise): exam-style questions from `POST /flashcards/sets/:id/exercises`. */
export function ExerciseMode({set}: {set: FlashcardSet}) {
  const t = useTranslations('flashcard.study');
  if (set.cards.length < EXERCISE_MIN_CARDS) {
    return <NeedMoreCards set={set} modeLabel={t('exercise')} min={EXERCISE_MIN_CARDS} />;
  }
  return <Practice set={set} />;
}

type Problem = {kind: 'quota'} | {kind: 'noCards'} | {kind: 'error'; text: string; retry: boolean};

function Practice({set}: {set: FlashcardSet}) {
  const t = useTranslations('flashcard.study');
  const errorMessage = useErrorMessage();
  const [kinds, setKinds] = useState<ExerciseKind[]>(['single_choice', 'completion']);
  const [count, setCount] = useState<10 | 20>(10);
  const [generating, setGenerating] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [questions, setQuestions] = useState<ExerciseQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<ReturnType<typeof grade> | null>(null);
  const asking = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const session = useStudySession(set.id, 'exercise', true);

  const wait = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  useEffect(() => {
    if (wait <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [wait > 0]);

  useEffect(() => {
    if (questions || problem) heading.current?.focus();
  }, [questions, problem]);

  async function generate(e?: React.FormEvent) {
    e?.preventDefault();
    if (asking.current || wait > 0 || kinds.length === 0) return;
    asking.current = true;
    setGenerating(true);
    setProblem(null);
    try {
      const res = GenerateExerciseResponseSchema.parse(
        await api(`/flashcards/sets/${set.id}/exercises`, {method: 'POST', body: {kinds, count}}),
      );
      setQuestions(ordered(res.questions));
      setAnswers({});
      setChecked(null);
    } catch (err) {
      const http = err instanceof ApiError ? err.httpStatus : 0;
      if (http === 429) setProblem({kind: 'quota'});
      else if (http === 422) setProblem({kind: 'noCards'});
      else if (http === 502) {
        // The same request fails at once on the server for a minute, so wait it out here too.
        setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000);
        setNow(Date.now());
        setProblem({kind: 'error', text: t('exerciseInvalid'), retry: true});
      } else if (http === 503) setProblem({kind: 'error', text: t('exerciseUnavailable'), retry: true});
      else setProblem({kind: 'error', text: errorMessage(err), retry: true});
    }
    asking.current = false;
    setGenerating(false);
  }

  const units = questions ? unitsOf(questions) : [];
  function check(e: React.FormEvent) {
    e.preventDefault();
    if (checked) return;
    const result = grade(units, answers);
    setChecked(result);
    void session.end({cardsStudied: result.total, correctCount: result.correct});
  }
  const again = () => {
    setQuestions(null);
    setChecked(null);
    setAnswers({});
  };

  const shell = (children: React.ReactNode) => (
    <StudyShell
      setId={set.id}
      title={set.title}
      modeLabel={questions ? t('exerciseCount', {count: units.length}) : t('exercise')}
      onExit={() => (checked ? undefined : session.end({cardsStudied: 0, correctCount: 0}))}
    >
      {children}
    </StudyShell>
  );

  if (generating) {
    return shell(
      <section className={cn(card, 'items-center p-10 text-center')} aria-busy="true">
        <Sparkles className="size-10 animate-pulse text-primary motion-reduce:animate-none" aria-hidden="true" />
        <p className="font-semibold" role="status">
          {t('exerciseGenerating', {count})}
        </p>
        <p className="text-[13px] text-muted-foreground">{t('exerciseGeneratingHint')}</p>
      </section>,
    );
  }

  if (problem?.kind === 'quota') {
    return shell(
      <section role="alert" className={cn(card, 'items-center p-10 text-center')}>
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
          <CircleAlert className="size-6" aria-hidden="true" />
        </span>
        <h1 ref={heading} tabIndex={-1} className="font-bold outline-none">
          {t('exerciseQuotaTitle')}
        </h1>
        <p className="text-muted-foreground">{t('exerciseQuotaBody')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild className="h-11 rounded-full px-5">
            <Link href={`/flashcards/${set.id}/study/test`}>{t('toTest')}</Link>
          </Button>
          <Button variant="outline" className="h-11 rounded-full px-5" onClick={() => setProblem(null)}>
            {t('exerciseBack')}
          </Button>
        </div>
      </section>,
    );
  }

  if (!questions) {
    return shell(
      <form className={card} onSubmit={generate}>
        <div>
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-[28px] leading-tight font-semibold tracking-[-0.03em] outline-none"
          >
            {t('exerciseTitle')}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('exerciseIntro', {min: EXERCISE_MIN_CARDS})}</p>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t('exerciseKinds')}</legend>
          <div className="flex flex-wrap gap-2">
            {KIND_ORDER.map(kind => (
              <label key={kind} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={kinds.includes(kind)}
                  onChange={e => setKinds(withKind(kinds, kind, e.target.checked))}
                />
                {t(`exerciseKind.${kind}`)}
              </label>
            ))}
          </div>
          {kinds.length === 0 && (
            <p role="alert" className="mt-2 flex items-center gap-1 text-[13px] text-destructive">
              <CircleAlert className="size-3.5" aria-hidden="true" />
              {t('exerciseKindsNone')}
            </p>
          )}
        </fieldset>
        <label className="flex flex-col gap-1.5 sm:max-w-40">
          <span className="text-sm font-semibold">{t('exerciseCountLabel')}</span>
          <select className={inputClass} value={count} onChange={e => setCount(e.target.value === '20' ? 20 : 10)}>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>
        {problem && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-destructive">
            {problem.kind === 'error' ? (
              <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <span>{problem.kind === 'error' ? problem.text : t('needCardsTitle', {min: EXERCISE_MIN_CARDS})}</span>
          </div>
        )}
        <Button
          type="submit"
          size="lg"
          className="h-12 rounded-full px-6 sm:w-fit"
          disabled={kinds.length === 0 || wait > 0}
        >
          <Sparkles aria-hidden="true" />
          {wait > 0
            ? t('exerciseWait', {seconds: wait})
            : problem?.kind === 'error'
              ? t('exerciseRetry')
              : t('exerciseCreate')}
        </Button>
        <p className="text-[13px] text-muted-foreground">{t('exerciseByAi')}</p>
      </form>,
    );
  }

  const first = (u: Unit) => units.find(x => x.question === u.question)?.number === u.number;
  const groups = KIND_ORDER.map(kind => ({kind, units: units.filter(u => u.kind === kind)})).filter(
    g => g.units.length,
  );
  return shell(
    <form className="flex flex-col gap-6" onSubmit={check} noValidate>
      <h1 ref={heading} tabIndex={-1} className="sr-only">
        {t('exerciseTitle')}
      </h1>
      {groups.map(({kind, units: list}) => (
        <section key={kind} className={card} aria-labelledby={`group-${kind}`}>
          <h2 id={`group-${kind}`} className="font-bold">
            {t(list.length === 1 ? 'exerciseGroupOne' : 'exerciseGroup', {
              from: list[0].number,
              to: list.at(-1)!.number,
              instruction: t(`exerciseInstruction.${kind}`),
            })}
          </h2>
          {kind === 'matching' ? (
            <MatchingGroup
              units={list}
              answers={answers}
              checked={checked}
              onAnswer={(k, v) => setAnswers(a => ({...a, [k]: v}))}
              first={first}
            />
          ) : (
            list.map(u => (
              <Item
                key={u.key}
                unit={u}
                value={answers[u.key] ?? ''}
                checked={checked}
                onAnswer={v => setAnswers(a => ({...a, [u.key]: v}))}
              />
            ))
          )}
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {checked ? (
          <>
            <p className="flex-1 font-semibold" role="status">
              {t('exerciseScore', {correct: checked.correct, total: checked.total})}
            </p>
            <Button type="button" variant="secondary" className="h-11 rounded-full px-5" onClick={again}>
              {t('exerciseAnother')}
            </Button>
            <Button asChild variant="ghost" className="h-11 rounded-full px-5">
              <Link href={`/flashcards/${set.id}`}>{t('backToSet')}</Link>
            </Button>
          </>
        ) : (
          <Button type="submit" size="lg" className="ml-auto h-12 rounded-full px-6">
            {t('exerciseCheck')}
          </Button>
        )}
      </div>
      <p className="text-[13px] text-muted-foreground">{t('exerciseByAi')}</p>
    </form>,
  );
}

/** The right or wrong line under a question, once the answers were checked. */
function Verdict({unit, checked}: {unit: Unit; checked: ReturnType<typeof grade> | null}) {
  const t = useTranslations('flashcard.study');
  if (!checked) return null;
  const right = checked.results[unit.key];
  return (
    <p className={cn('flex items-center gap-2 text-sm font-semibold', right ? 'text-success' : 'text-destructive')}>
      {right ? (
        <CircleCheck className="size-4" aria-hidden="true" />
      ) : (
        <CircleX className="size-4" aria-hidden="true" />
      )}
      {right ? t('exerciseRight') : t('exerciseAnswerIs', {number: unit.number, answer: unit.answer})}
    </p>
  );
}

/** A multiple-choice question or a sentence with a gap to type into. Plain text only: nothing here is HTML. */
function Item({
  unit,
  value,
  checked,
  onAnswer,
}: {
  unit: Unit;
  value: string;
  checked: ReturnType<typeof grade> | null;
  onAnswer: (value: string) => void;
}) {
  const t = useTranslations('flashcard.study');
  const parts = splitBlank(unit.prompt);
  if (unit.kind === 'completion') {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-serif text-[17px] leading-9 [overflow-wrap:anywhere]">
          <strong className="font-sans">({unit.number})</strong> {parts?.before}
          <input
            value={value}
            onChange={e => onAnswer(e.target.value)}
            readOnly={!!checked}
            aria-label={t('exerciseGap', {number: unit.number})}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={cn(inputClass, 'mx-1 inline-block h-9 min-h-0 w-40 align-baseline font-sans')}
          />
          {parts?.after ?? unit.prompt}
        </p>
        <Verdict unit={unit} checked={checked} />
      </div>
    );
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 [overflow-wrap:anywhere]">
        <strong>{unit.number}.</strong> {parts ? `${parts.before}______${parts.after}` : unit.prompt}
      </legend>
      {unit.options.map((option, i) => (
        <label
          key={option + i}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-lg border p-3 text-sm',
            value === option && 'border-primary bg-secondary',
            checked && option === unit.answer && 'border-success bg-success-soft',
          )}
        >
          <input
            type="radio"
            name={`q-${unit.key}`}
            className="size-4 accent-primary"
            checked={value === option}
            disabled={!!checked}
            onChange={() => onAnswer(option)}
          />
          <span className="[overflow-wrap:anywhere]">
            {String.fromCharCode(65 + i)}. {option}
          </span>
        </label>
      ))}
      <Verdict unit={unit} checked={checked} />
    </fieldset>
  );
}

/** Match each sentence with a term from the shared list (one question of the matching kind). */
function MatchingGroup({
  units,
  answers,
  checked,
  onAnswer,
  first,
}: {
  units: Unit[];
  answers: Record<string, string>;
  checked: ReturnType<typeof grade> | null;
  onAnswer: (key: string, value: string) => void;
  first: (u: Unit) => boolean;
}) {
  const t = useTranslations('flashcard.study');
  return (
    <div className="flex flex-col gap-4">
      {units.map(u => {
        const parts = splitBlank(u.prompt);
        return (
          <div key={u.key} className="flex flex-col gap-2">
            {first(u) && u.options.length > 0 && (
              <p className="rounded-lg bg-muted p-3 text-sm">
                <strong>{t('exerciseTerms')}</strong> {u.options.join(' · ')}
              </p>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="[overflow-wrap:anywhere]">
                <strong>{u.number}.</strong> {parts ? `${parts.before}______${parts.after}` : u.prompt}
              </span>
              <select
                className={inputClass}
                value={answers[u.key] ?? ''}
                disabled={!!checked}
                onChange={e => onAnswer(u.key, e.target.value)}
              >
                <option value="">{t('exerciseChoose')}</option>
                {u.options.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <Verdict unit={u} checked={checked} />
          </div>
        );
      })}
    </div>
  );
}
