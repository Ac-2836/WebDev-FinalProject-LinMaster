'use client';

import {cn} from 'cn';
import {GripVertical} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

import {QuestionGroupView} from './question-views';
import type {Answers, ExamGroup, ExamPassage, Highlight, Struck} from './reading-logic';
import {ReadingPassage} from './reading-passage';

export interface ReadingRoomProps {
  passage: ExamPassage;
  groups: ExamGroup[];
  answers: Answers;
  onAnswer: (patch: Record<number, string | null>) => void;
  highlights: readonly Highlight[];
  onHighlightsChange: (next: Highlight[]) => void;
  struck: Struck;
  onStrike: (question: number, key: string) => void;
  /** The question shown in the bottom navigation; focusing a question reports it back. */
  current: number;
  onCurrentChange: (question: number) => void;
}

const MIN_SPLIT = 25;
const MAX_SPLIT = 75;
const clampSplit = (value: number) => Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, Math.round(value)));

/**
 * Reading part of the exam room (wireframe 05-exam/room-reading): passage and questions side by side with a
 * draggable divider from 1024px, a Passage / Questions switch below. Goes inside the P3-12 `ExamRoom` frame.
 */
export function ReadingRoom({
  passage,
  groups,
  answers,
  onAnswer,
  highlights,
  onHighlightsChange,
  struck,
  onStrike,
  current,
  onCurrentChange,
}: ReadingRoomProps) {
  const [split, setSplit] = useState(50);
  const [pane, setPane] = useState<'passage' | 'questions'>('passage');
  const container = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const shownQuestion = useRef(current);

  // Navigating from the bottom bar: show that question (switching to the questions pane on small screens).
  useEffect(() => {
    if (shownQuestion.current === current) return;
    shownQuestion.current = current;
    const el = document.getElementById(`q-${current}`);
    if (!el) return;
    if (!el.offsetParent) setPane('questions');
    requestAnimationFrame(() => el.scrollIntoView({block: 'nearest'}));
  }, [current]);

  const focusQuestion = (n: number) => {
    shownQuestion.current = n;
    if (n !== current) onCurrentChange(n);
  };

  const fromNo = groups[0]?.fromNo;
  const toNo = groups[groups.length - 1]?.toNo;

  function dragTo(clientX: number) {
    const rect = container.current?.getBoundingClientRect();
    if (rect) setSplit(clampSplit(((clientX - rect.left) / rect.width) * 100));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 border-b border-current/20 font-sans text-sm font-semibold lg:hidden">
        {(['passage', 'questions'] as const).map(name => (
          <button
            key={name}
            type="button"
            aria-pressed={pane === name}
            onClick={() => setPane(name)}
            className={cn(
              'min-h-11 flex-1 border-b-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
              pane === name ? 'border-primary text-primary' : 'border-transparent opacity-70',
            )}
          >
            {name === 'passage' ? 'Passage' : `Questions ${fromNo}–${toNo}`}
          </button>
        ))}
      </div>

      <div ref={container} className="flex min-h-0 flex-1" style={{'--split': `${split}%`} as React.CSSProperties}>
        <section
          id="reading-passage"
          aria-label="Reading passage"
          className={cn(
            'min-w-0 flex-1 overflow-y-auto p-5 sm:p-8 lg:block lg:shrink-0 lg:grow-0 lg:basis-[var(--split)]',
            pane !== 'passage' && 'hidden',
          )}
        >
          <ReadingPassage passage={passage} highlights={highlights} onHighlightsChange={onHighlightsChange} />
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels. Use left and right arrow keys"
          aria-controls="reading-passage"
          aria-valuenow={split}
          aria-valuemin={MIN_SPLIT}
          aria-valuemax={MAX_SPLIT}
          tabIndex={0}
          className="hidden w-3 shrink-0 cursor-col-resize touch-none items-center justify-center border-x border-current/20 bg-black/5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:flex"
          onPointerDown={e => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={e => dragging.current && dragTo(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onKeyDown={e => {
            const step = {ArrowLeft: -5, ArrowRight: 5}[e.key];
            if (step) setSplit(s => clampSplit(s + step));
            else if (e.key === 'Home') setSplit(MIN_SPLIT);
            else if (e.key === 'End') setSplit(MAX_SPLIT);
            else return;
            e.preventDefault();
          }}
        >
          <GripVertical className="size-3 opacity-60" aria-hidden="true" />
        </div>

        <section
          aria-label={`Questions ${fromNo} to ${toNo}`}
          className={cn('min-w-0 flex-1 overflow-y-auto p-5 sm:p-8 lg:block', pane !== 'questions' && 'hidden')}
        >
          <div className="flex flex-col gap-10">
            {groups.map(group => (
              <QuestionGroupView
                key={group.fromNo}
                group={group}
                answers={answers}
                current={current}
                onAnswer={onAnswer}
                struck={struck}
                onStrike={onStrike}
                onFocusQuestion={focusQuestion}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
