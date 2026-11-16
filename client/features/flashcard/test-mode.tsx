'use client';

import {QUIZ_MIN_CARDS, QuizResponseSchema, type FlashcardSet, type QuizQuestion} from '@linmaster/shared';
import {ArrowRight, Check, CircleCheck, CircleX, CloudOff, RotateCw, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useCallback, useEffect, useRef, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {api, ApiError} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {NeedMoreCards} from './match-mode';
import {isTypedCorrect, percent} from './quiz-logic';
import {StudyShell} from './study-shell';
import {useStudyKeys, useStudySession} from './study-session';

const kbd = 'inline-flex size-7 shrink-0 items-center justify-center rounded-md border bg-card font-mono text-xs';
const card = 'flex flex-col gap-6 rounded-[20px] border bg-card p-6 shadow-soft sm:p-8';

/** What the learner did with the current question. */
interface Answer {
  correct: boolean;
  /** The option picked, the text typed or `true`/`false`; empty when they gave up. */
  given: string;
}

type Load = {status: 'loading'} | {status: 'failed'; message: string} | {status: 'ready'; questions: QuizQuestion[]};

/** Kiểm tra (C3, wireframe 04-flashcard/study-test): questions from `GET /flashcards/sets/:id/quiz`, graded here. */
export function TestMode({set}: {set: FlashcardSet}) {
  const t = useTranslations('flashcard.study');
  if (set.cards.length < QUIZ_MIN_CARDS) {
    return <NeedMoreCards set={set} modeLabel={t('test')} min={QUIZ_MIN_CARDS} />;
  }
  return <Quiz set={set} />;
}

function Quiz({set}: {set: FlashcardSet}) {
  const t = useTranslations('flashcard.study');
  const errorMessage = useErrorMessage();
  const [load, setLoad] = useState<Load>({status: 'loading'});
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [wrong, setWrong] = useState<QuizQuestion[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [typed, setTyped] = useState('');
  const next = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const session = useStudySession(set.id, 'test', true);
  const finished = load.status === 'ready' && index >= questions.length;
  const question = questions[index];

  const start = useCallback((list: QuizQuestion[]) => {
    setQuestions(list);
    setIndex(0);
    setAnswer(null);
    setWrong([]);
    setCorrectCount(0);
    setTyped('');
  }, []);

  const fetchQuiz = useCallback(
    (signal?: AbortSignal) => {
      setLoad({status: 'loading'});
      api(`/flashcards/sets/${set.id}/quiz`, {signal})
        .then(res => {
          const list = QuizResponseSchema.parse(res).questions;
          start(list);
          setLoad({status: 'ready', questions: list});
        })
        .catch(err => {
          if (signal?.aborted) return;
          setLoad({
            status: 'failed',
            message:
              err instanceof ApiError && err.httpStatus === 422
                ? t('needCardsTitle', {min: QUIZ_MIN_CARDS})
                : errorMessage(err),
          });
        });
    },
    // `errorMessage` changes every render; the quiz must load once per set.
    [set.id, start, t],
  );
  useEffect(() => {
    const controller = new AbortController();
    fetchQuiz(controller.signal);
    return () => controller.abort();
  }, [fetchQuiz]);

  // After an answer the next button takes focus, so Enter moves on; on a new written question the field does.
  useEffect(() => {
    if (answer) next.current?.focus();
    else if (question?.kind === 'written') input.current?.focus();
  }, [answer, question]);

  useEffect(() => {
    if (finished) void session.end({cardsStudied: questions.length, correctCount});
    // The result screen is reached once per quiz.
  }, [finished]);

  function submit(correct: boolean, given: string) {
    if (answer || !question) return;
    setAnswer({correct, given});
    if (correct) setCorrectCount(c => c + 1);
    else setWrong(w => [...w, question]);
  }
  function advance() {
    setAnswer(null);
    setTyped('');
    setIndex(i => i + 1);
  }

  useStudyKeys(key => {
    if (answer || !question) return;
    const n = Number(key);
    if (question.kind === 'multiple-choice' && n >= 1 && n <= question.options.length) {
      const option = question.options[n - 1];
      submit(option === question.answer, option);
    } else if (question.kind === 'true-false' && (n === 1 || n === 2)) {
      submit((n === 1) === question.answer, String(n === 1));
    }
  });

  const shell = (children: React.ReactNode, label = t('test'), progress?: React.ReactNode) => (
    <StudyShell
      setId={set.id}
      title={set.title}
      modeLabel={label}
      onExit={() => (finished ? undefined : session.end({cardsStudied: index, correctCount}))}
      progress={progress}
    >
      {children}
    </StudyShell>
  );

  if (load.status === 'loading') {
    return shell(
      <div className="flex flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
        <Skeleton className="h-64 w-full rounded-[20px]" />
        <Skeleton className="h-12 w-1/2" />
      </div>,
    );
  }
  if (load.status === 'failed') {
    return shell(
      <div role="alert" className="my-auto flex flex-col items-center gap-3 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
          <CloudOff className="size-6" aria-hidden="true" />
        </span>
        <p className="font-bold">{t('testLoadError')}</p>
        <p className="text-sm text-muted-foreground">{load.message}</p>
        <Button variant="outline" className="h-10 rounded-full" onClick={() => fetchQuiz()}>
          <RotateCw aria-hidden="true" />
          {t('retry')}
        </Button>
      </div>,
    );
  }

  if (finished) {
    const score = percent(correctCount, questions.length);
    return shell(
      <section className="flex flex-col items-center gap-6 py-6 text-center">
        <div
          className="relative inline-flex size-36 items-center justify-center rounded-full"
          style={{background: `conic-gradient(var(--color-success) 0 ${score}%, var(--color-muted) 0)`}}
          role="img"
          aria-label={t('testScoreLabel', {correct: correctCount, total: questions.length})}
        >
          <div className="flex size-28 flex-col items-center justify-center rounded-full bg-card">
            <span className="text-3xl font-bold">{score}%</span>
            <span className="text-[13px] text-muted-foreground">
              {correctCount}/{questions.length}
            </span>
          </div>
        </div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">
          {score >= 90 ? t('testGreat') : score >= 70 ? t('testGood') : t('testKeepGoing')}
        </h1>
        {wrong.length > 0 && (
          <div className="w-full text-left">
            <h2 className="mb-2 text-sm font-semibold">{t('testWrongCount', {count: wrong.length})}</h2>
            <ul className="divide-y rounded-[20px] border bg-card text-sm shadow-soft">
              {wrong.map(q => (
                <li key={q.cardId + q.kind} className="flex flex-wrap justify-between gap-x-3 gap-y-1 p-3">
                  <strong className="break-words">{q.prompt}</strong>
                  <span className="break-words text-muted-foreground">
                    {q.kind === 'true-false' ? `${q.statement} · ${q.answer ? t('true') : t('false')}` : q.answer}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          {wrong.length > 0 && (
            <Button className="h-11 rounded-full px-5" onClick={() => start(wrong)}>
              {t('testRedoWrong')}
            </Button>
          )}
          <Button variant="outline" className="h-11 rounded-full px-5" onClick={() => fetchQuiz()}>
            {t('testNew')}
          </Button>
          <Button asChild variant="ghost" className="h-11 rounded-full px-5">
            <Link href={`/flashcards/${set.id}`}>{t('backToSet')}</Link>
          </Button>
        </div>
      </section>,
      t('test'),
    );
  }

  const nextButton = (
    <Button ref={next} className="h-11 rounded-full px-5" onClick={advance}>
      {index === questions.length - 1 ? t('testFinish') : t('testNext')}
      <ArrowRight aria-hidden="true" />
    </Button>
  );
  const verdict = answer && (
    <div className="flex items-center gap-3" role="status">
      <p className={cn('flex-1 font-semibold', answer.correct ? 'text-success' : 'text-destructive')}>
        {answer.correct ? t('testCorrect') : t('testWrong')}
      </p>
      {nextButton}
    </div>
  );

  return shell(
    <section className={card} aria-live="polite">
      {question.kind === 'multiple-choice' && (
        <>
          <div>
            <p className="text-[13px] text-muted-foreground">{t('testChoosePrompt')}</p>
            <p className="mt-2 text-3xl font-bold break-words">{question.prompt}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {question.options.map((option, i) => {
              const right = !!answer && option === question.answer;
              const bad = !!answer && !answer.correct && option === answer.given;
              return (
                <button
                  key={option + i}
                  type="button"
                  disabled={!!answer}
                  onClick={() => submit(option === question.answer, option)}
                  className={cn(
                    'flex min-h-14 items-center gap-3 rounded-xl border-2 p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    !answer && 'hover:border-primary',
                    right && 'border-success bg-success-soft font-semibold text-success disabled:opacity-100',
                    bad && 'border-destructive bg-danger-soft text-destructive disabled:opacity-100',
                    answer && !right && !bad && 'opacity-60',
                  )}
                >
                  {right ? (
                    <CircleCheck className="size-7 shrink-0" aria-hidden="true" />
                  ) : bad ? (
                    <CircleX className="size-7 shrink-0" aria-hidden="true" />
                  ) : (
                    <kbd className={kbd} aria-hidden="true">
                      {i + 1}
                    </kbd>
                  )}
                  <span className="break-words">{option}</span>
                </button>
              );
            })}
          </div>
          {verdict}
          {!answer && <p className="text-center text-[13px] text-muted-foreground">{t('testChoiceHelp')}</p>}
        </>
      )}

      {question.kind === 'written' && (
        <form
          className="flex flex-col gap-5"
          onSubmit={e => {
            e.preventDefault();
            if (!answer && typed.trim()) submit(isTypedCorrect(typed, question.answer), typed);
          }}
        >
          <div>
            <p className="text-[13px] text-muted-foreground">{t('testTypePrompt')}</p>
            <p className="mt-2 text-2xl font-bold break-words">{question.prompt}</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">{t('testAnswerLabel')}</span>
            <Input
              ref={input}
              value={typed}
              onChange={e => setTyped(e.target.value)}
              readOnly={!!answer}
              placeholder={t('testAnswerPlaceholder')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={answer ? !answer.correct : undefined}
              className="min-h-12 text-lg"
            />
          </label>
          {answer && !answer.correct && (
            <div className="rounded-xl bg-danger-soft p-4 text-sm">
              <p>
                {t('testAnswerIs')} <strong>{question.answer}</strong>
              </p>
            </div>
          )}
          {answer ? (
            verdict
          ) : (
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-full px-5"
                onClick={() => submit(false, '')}
              >
                {t('testDontKnow')}
              </Button>
              <Button type="submit" className="h-11 rounded-full px-5" disabled={!typed.trim()}>
                <Check aria-hidden="true" />
                {t('testCheck')}
              </Button>
            </div>
          )}
        </form>
      )}

      {question.kind === 'true-false' && (
        <>
          <p className="text-[13px] text-muted-foreground">{t('testTrueFalsePrompt')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="text-2xl font-bold break-words">{question.prompt}</p>
            <p className="text-xl break-words">{question.statement}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[true, false].map((value, i) => {
              const chosen = answer?.given === String(value);
              const right = !!answer && value === question.answer;
              return (
                <Button
                  key={String(value)}
                  type="button"
                  variant={answer ? 'ghost' : 'secondary'}
                  size="lg"
                  disabled={!!answer}
                  onClick={() => submit(value === question.answer, String(value))}
                  className={cn(
                    'h-12 rounded-xl text-base',
                    answer && !right && !chosen && 'opacity-60',
                    right && 'bg-success-soft text-success disabled:opacity-100',
                    chosen && !right && 'bg-danger-soft text-destructive disabled:opacity-100',
                  )}
                >
                  {value ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
                  {value ? t('true') : t('false')}
                  <kbd className={cn(kbd, 'ml-1')} aria-hidden="true">
                    {i + 1}
                  </kbd>
                </Button>
              );
            })}
          </div>
          {verdict}
        </>
      )}
    </section>,
    t('testPosition', {n: index + 1, total: questions.length}),
    <div className="h-1 bg-muted">
      <div className="h-full bg-primary transition-[width]" style={{width: `${(index / questions.length) * 100}%`}} />
    </div>,
  );
}
