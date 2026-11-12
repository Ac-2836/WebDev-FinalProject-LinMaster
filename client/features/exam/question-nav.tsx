'use client';

import {cn} from 'cn';
import {ArrowLeft, ArrowRight, Check} from 'lucide-react';
import {useEffect, useRef} from 'react';

import {Button} from '@/components/ui/button';

import {adjacentQuestion, partOf, partProgress, questionState, type RoomPart} from './room-logic';

export interface QuestionNavProps {
  parts: RoomPart[];
  current: number;
  answered: ReadonlySet<number>;
  flagged: ReadonlySet<number>;
  onNavigate: (question: number) => void;
  onToggleReview: (question: number) => void;
  onSubmit: () => void;
}

/** Bottom bar (wireframe 05-exam/room-*): Review flag, Part tabs with question numbers, previous / next, submit. */
export function QuestionNav({
  parts,
  current,
  answered,
  flagged,
  onNavigate,
  onToggleReview,
  onSubmit,
}: QuestionNavProps) {
  const currentPart = partOf(parts, current);
  const prev = adjacentQuestion(parts, current, -1);
  const next = adjacentQuestion(parts, current, 1);
  const currentButton = useRef<HTMLButtonElement>(null);
  // Narrow screens scroll the bar: keep the current number in view.
  useEffect(() => {
    currentButton.current?.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }, [current]);

  return (
    <footer className="shrink-0 border-t bg-white">
      <div className="flex items-stretch">
        {/* Hidden under 640px like the wireframe: the bar keeps room for the numbers. */}
        <label className="hidden cursor-pointer items-center gap-2 border-r px-4 text-sm sm:flex">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={flagged.has(current)}
            onChange={() => onToggleReview(current)}
          />
          Review
        </label>
        <nav
          aria-label="Question navigation"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 py-1.5"
        >
          {parts.map(part => {
            const {done, total} = partProgress(part, answered);
            if (part !== currentPart) {
              return (
                <button
                  key={part.id}
                  type="button"
                  className="min-h-11 shrink-0 rounded-md px-3 text-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onClick={() => onNavigate(part.questions[0])}
                >
                  <strong>{part.title}</strong>{' '}
                  <span className="text-muted-foreground">
                    {done} of {total}
                  </span>
                </button>
              );
            }
            return (
              <div key={part.id} className="flex shrink-0 items-center gap-1 rounded-md bg-muted/70 px-2 py-1">
                <span className="mr-1 text-sm font-bold">{part.title}</span>
                {part.questions.map(n => {
                  const state = questionState(n, current, answered);
                  const isFlagged = flagged.has(n);
                  return (
                    <button
                      key={n}
                      ref={state === 'current' ? currentButton : undefined}
                      type="button"
                      onClick={() => onNavigate(n)}
                      aria-current={state === 'current' ? 'step' : undefined}
                      aria-label={`Question ${n}${state === 'answered' ? ', answered' : ''}${isFlagged ? ', marked for review' : ''}`}
                      className={cn(
                        'relative inline-flex size-11 items-center justify-center rounded text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:size-9',
                        state === 'current' && 'bg-primary text-white',
                        state === 'answered' && 'bg-white text-foreground underline decoration-2 underline-offset-4',
                        state === 'unanswered' && 'bg-white text-muted-foreground',
                        isFlagged && 'ring-2 ring-warning',
                      )}
                    >
                      {n}
                      {isFlagged && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warning" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="flex items-center gap-1 border-l px-2">
          <Button
            variant="secondary"
            size="icon"
            className="size-11 lg:size-9"
            aria-label="Previous question"
            disabled={prev === null}
            onClick={() => prev !== null && onNavigate(prev)}
          >
            <ArrowLeft />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-11 lg:size-9"
            aria-label="Next question"
            disabled={next === null}
            onClick={() => next !== null && onNavigate(next)}
          >
            <ArrowRight />
          </Button>
          <Button size="icon" className="size-11 lg:size-9" aria-label="Submit test" onClick={onSubmit}>
            <Check className="size-5" />
          </Button>
        </div>
      </div>
    </footer>
  );
}
