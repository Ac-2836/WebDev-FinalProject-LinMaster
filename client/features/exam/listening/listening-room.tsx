'use client';

import type {AttemptAudio, CandidatePassage} from '@linmaster/shared';
import {CircleAlert, Headphones, LoaderCircle, Play, Volume2} from 'lucide-react';
import {useEffect, useRef} from 'react';

import {Button} from '@/components/ui/button';

import {QuestionGroupView} from '../reading/question-views';
import type {Answers, Struck} from '../reading/reading-logic';
import {useExamAudio, type AudioStatus} from './use-exam-audio';

export interface ListeningRoomProps {
  /** Audio of the running section from the attempt payload; null when the test has none. */
  audio: AttemptAudio | null;
  /** The Part of the current question, with its question groups. */
  passage: CandidatePassage;
  /** Minutes to check answers once the recording is over (certification `reviewSec`). */
  reviewMinutes: number;
  answers: Answers;
  onAnswer: (patch: Record<number, string | null>) => void;
  struck: Struck;
  onStrike: (question: number, key: string) => void;
  current: number;
  onCurrentChange: (question: number) => void;
}

const STATUS_TEXT: Record<Exclude<AudioStatus, 'blocked'>, string> = {
  waiting: 'Loading the recording…',
  playing: 'The recording is playing. It cannot be paused or replayed.',
  ended: 'The recording has ended.',
  none: 'This test has no recording. Answer the questions in the time given.',
  error: 'The recording could not be loaded. Tell the test owner, and answer what you can.',
};

/**
 * Listening part of the exam room (wireframe 05-exam/room-listening): the recording plays on its own from the
 * position the server gives, and the questions of the current Part are listed below it.
 */
export function ListeningRoom({
  audio,
  passage,
  reviewMinutes,
  answers,
  onAnswer,
  struck,
  onStrike,
  current,
  onCurrentChange,
}: ListeningRoomProps) {
  const {status, volume, setVolume, resume} = useExamAudio(audio);
  const shownQuestion = useRef(current);
  const column = useRef<HTMLElement>(null);

  // Navigating from the bottom bar: show that question.
  useEffect(() => {
    if (shownQuestion.current === current) return;
    shownQuestion.current = current;
    document.getElementById(`q-${current}`)?.scrollIntoView({block: 'nearest'});
  }, [current]);

  // A new Part starts at its first question.
  useEffect(() => {
    column.current?.scrollTo({top: 0});
  }, [passage.id]);

  const focusQuestion = (n: number) => {
    shownQuestion.current = n;
    if (n !== current) onCurrentChange(n);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-current/20 px-5 py-3 font-sans text-sm sm:px-8">
        {status === 'blocked' ? (
          <Button className="h-11 px-5" onClick={resume}>
            <Play aria-hidden="true" />
            Continue the recording
          </Button>
        ) : (
          <p role="status" className="flex min-w-0 flex-1 basis-60 items-center gap-2">
            {status === 'waiting' ? (
              <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : status === 'error' ? (
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <Headphones className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {STATUS_TEXT[status]}
              {status === 'ended' && reviewMinutes > 0 && ` You have ${reviewMinutes} minutes to check your answers.`}
            </span>
          </p>
        )}
        {status !== 'none' && (
          <label className="flex items-center gap-2">
            <Volume2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="h-11 w-32 accent-primary"
            />
          </label>
        )}
      </div>

      <section
        ref={column}
        aria-label={`Questions ${passage.groups[0]?.fromNo} to ${passage.groups.at(-1)?.toNo}`}
        className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-10">
          {passage.groups.map(group => (
            <QuestionGroupView
              key={group.id}
              group={group}
              paragraphLabels={[]}
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
  );
}
