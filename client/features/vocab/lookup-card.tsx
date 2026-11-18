'use client';

import {BookmarkPlus, CircleAlert, CircleCheck, LoaderCircle, Sparkles, Volume2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';

import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';

import type {WordExplanation} from '@linmaster/shared';
import {useVocabLabels} from '@/core/i18n/vocab-labels';

export type LookupState =
  | {status: 'loading'}
  | {status: 'error'; message: string; quota: boolean}
  | {
      status: 'ready' | 'saving' | 'saved';
      explanation: WordExplanation;
      alreadySaved: boolean;
      /** The phrase the AI explained when it is not what the user selected. */
      adjustedTo: string | null;
    };

export interface LookupCardProps {
  text: string;
  state: LookupState;
  onSave: () => void;
  onClose: () => void;
}

const badge = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold';

/** Body of the lookup popover / bottom sheet (wireframe 03-vocab/reader). */
export function LookupCard({text, state, onSave, onClose}: LookupCardProps) {
  const t = useTranslations('vocab.lookup');
  const labels = useVocabLabels();

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Sparkles className="size-4 animate-pulse text-primary" aria-hidden="true" />
          {t('loading', {text})}
        </p>
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="flex flex-col gap-2 text-sm">
        <p className="flex items-center gap-2 font-semibold text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {state.quota ? t('quotaTitle') : t('errorTitle')}
        </p>
        <p className="text-muted-foreground">{state.message}</p>
        <Button variant="outline" className="h-10 w-fit rounded-full" onClick={onClose}>
          {t('close')}
        </Button>
      </div>
    );
  }

  const e = state.explanation;
  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(e.headword);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-lg font-bold">{e.headword}</span>
        {e.ipa && <span className="text-muted-foreground">{e.ipa}</span>}
        {'speechSynthesis' in globalThis && (
          <Button variant="ghost" size="icon-sm" onClick={speak} aria-label={t('speak', {word: e.headword})}>
            <Volume2 aria-hidden="true" />
          </Button>
        )}
        <span className="ml-auto flex gap-1">
          <span className={`${badge} bg-muted text-muted-foreground`}>{labels.pos(e.partOfSpeech)}</span>
          {e.cefr && <span className={`${badge} bg-secondary text-primary`}>{e.cefr}</span>}
        </span>
      </div>
      {state.adjustedTo && (
        <p className="text-[13px] text-muted-foreground" role="status">
          {t('adjusted', {text: state.adjustedTo})}
        </p>
      )}
      <p className="text-base font-semibold">{e.meaningVi}</p>
      {e.definitionEn && <p className="text-muted-foreground">{e.definitionEn}</p>}
      {e.usageNote && (
        <p className="rounded-lg bg-muted p-2.5 text-[13px]">
          <strong>{t('usage')}</strong> {e.usageNote}
        </p>
      )}
      {e.collocations.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('collocations')}>
          {e.collocations.map(c => (
            <li key={c} className={`${badge} bg-muted text-foreground`}>
              {c}
            </li>
          ))}
        </ul>
      )}
      {e.topics.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('topics')}>
          {e.topics.map(topic => (
            <li key={topic} className={`${badge} bg-secondary text-primary`}>
              {labels.topic(topic)}
            </li>
          ))}
        </ul>
      )}
      {state.status === 'saved' ? (
        <p className="flex items-center gap-2 border-t pt-3 text-success" role="status">
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 font-semibold">{t('saved')}</span>
          <Link href="/vocab" className="font-semibold text-primary hover:underline">
            {t('openBank')}
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-2 border-t pt-3">
          {state.alreadySaved && <p className="text-[13px] text-muted-foreground">{t('alreadySaved')}</p>}
          <div className="flex gap-2">
            <Button
              className="h-11 flex-1 rounded-full"
              onClick={onSave}
              disabled={state.status === 'saving'}
              aria-busy={state.status === 'saving'}
            >
              {state.status === 'saving' ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <BookmarkPlus aria-hidden="true" />
              )}
              {t('save')}
            </Button>
            <Button variant="outline" className="h-11 rounded-full px-5" onClick={onClose}>
              {t('close')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
