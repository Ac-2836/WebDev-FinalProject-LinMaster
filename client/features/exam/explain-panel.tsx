'use client';

import {
  ExplainQuestionResponseSchema,
  type CandidateTest,
  type QuestionExplanation,
  type ResultQuestion,
  type ResultTranscript,
} from '@linmaster/shared';
import {CircleAlert, FileCheck, LoaderCircle, Sparkles} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRef, useState} from 'react';

import {Button} from '@/components/ui/button';
import {api, ApiError} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {evidenceContext, findPrompt, splitEvidence} from './explain-logic';
import {givenText} from './result-logic';

export interface ExplainPanelProps {
  attemptId: string;
  question: ResultQuestion;
  test: CandidateTest | null;
  transcripts: readonly ResultTranscript[];
  /** What the AI already said about this question, kept by the page so closing the panel does not lose it. */
  cached: QuestionExplanation | undefined;
  onExplained: (explanation: QuestionExplanation) => void;
}

/**
 * The body of the explanation drawer (wireframe 05-exam/result, states explain-file and explain): the question, what
 * the learner answered, and either the explanation from the test file or one the learner asks the AI for.
 */
export function ExplainPanel({attemptId, question, test, transcripts, cached, onExplained}: ExplainPanelProps) {
  const t = useTranslations('exam.result');
  const errorMessage = useErrorMessage();
  const [loading, setLoading] = useState(false);
  // Set synchronously: two clicks in the same tick would otherwise both pass the `loading` check (3 model calls each).
  const asking = useRef(false);
  const [error, setError] = useState<{retry: boolean; text: string} | null>(null);
  const prompt = findPrompt(test, question.skill, question.number);

  async function ask() {
    if (asking.current) return;
    asking.current = true;
    setLoading(true);
    setError(null);
    try {
      // `skill` is always sent: full tests number Listening and Reading from 1 each.
      const res = await api(`/attempts/${attemptId}/questions/${question.number}/explain?skill=${question.skill}`, {
        method: 'POST',
      });
      onExplained(ExplainQuestionResponseSchema.parse(res).explanation);
    } catch (err) {
      const http = err instanceof ApiError ? err.httpStatus : 0;
      if (http === 422) setError({retry: false, text: t('explainNoText')});
      else if (http === 429) setError({retry: false, text: t('explainQuota')});
      else if (http === 502 || http === 503) setError({retry: true, text: t('explainAiFailed')});
      else setError({retry: true, text: errorMessage(err)});
    }
    asking.current = false;
    setLoading(false);
  }

  const evidence = cached?.evidence ?? [];
  return (
    <div className="flex flex-col gap-4">
      {prompt && (
        <p className="rounded-lg bg-muted p-3 break-words">
          <strong>{question.number}.</strong> {prompt}
        </p>
      )}
      <p>
        {t('yourAnswer', {
          given: givenText(question.given) ?? t('blank'),
          correct: question.correct.join(' / '),
        })}
      </p>

      {question.explanation ? (
        <>
          <p className="whitespace-pre-line">{question.explanation}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileCheck className="size-3.5" aria-hidden="true" />
            {t('fromFile')}
          </p>
        </>
      ) : cached ? (
        <>
          {evidence.length > 0 && (
            <section aria-labelledby="explain-evidence" className="flex flex-col gap-3">
              <h3 id="explain-evidence" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t('explainEvidence')}
              </h3>
              {evidence.map((e, i) => {
                const context = evidenceContext(e, test, transcripts);
                const parts = context && splitEvidence(context.text, e);
                return (
                  <blockquote key={i} className="border-l-4 border-primary pl-3">
                    {context && (
                      <p className="mb-1 text-xs text-muted-foreground not-italic">
                        {t('evidenceFrom', {title: context.title, label: context.label})}
                      </p>
                    )}
                    <p className="font-serif break-words">
                      {parts ? (
                        <>
                          {parts.before}
                          <mark className="rounded bg-brand-yellow/60 px-0.5">{parts.mark}</mark>
                          {parts.after}
                        </>
                      ) : (
                        <mark className="rounded bg-brand-yellow/60 px-0.5">{e.quote}</mark>
                      )}
                    </p>
                  </blockquote>
                );
              })}
            </section>
          )}
          <p className="whitespace-pre-line">{cached.text}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t('explainByAi')}
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4">
          <p className="text-muted-foreground">{t('explainNone')}</p>
          <Button className="h-11 w-fit rounded-full px-5" onClick={ask} disabled={loading} aria-busy={loading}>
            {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {loading ? t('explainLoading') : error?.retry ? t('explainRetry') : t('explainAsk')}
          </Button>
          {error && (
            <p role="alert" className="flex items-start gap-1 text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error.text}</span>
            </p>
          )}
          <p className="sr-only" role="status">
            {loading ? t('explainLoading') : ''}
          </p>
        </div>
      )}
    </div>
  );
}
