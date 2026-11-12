'use client';

// shortcut: temporary demo of the P3-12 shell with fake data, delete with app/(exam)/exam-demo before handover.
import {useState} from 'react';

import {ExamRoom, type SaveState} from './exam-room';
import type {RoomPart} from './room-logic';

const range = (from: number, to: number) => Array.from({length: to - from + 1}, (_, i) => from + i);
const PARTS: RoomPart[] = [
  {id: 'p1', title: 'Part 1', questions: range(1, 13)},
  {id: 'p2', title: 'Part 2', questions: range(14, 26)},
  {id: 'p3', title: 'Part 3', questions: range(27, 40)},
];

export function ExamRoomDemo({minutes}: {minutes: number}) {
  const [clock] = useState(() => {
    const now = Date.now();
    return {serverNow: new Date(now).toISOString(), deadlineAt: new Date(now + minutes * 60_000).toISOString()};
  });
  const [current, setCurrent] = useState(15);
  const [answers, setAnswers] = useState<Record<number, string>>(() =>
    Object.fromEntries([...range(1, 13), 14, 16, 19, 23].map(n => [n, 'A'])),
  );
  const [flagged, setFlagged] = useState<Set<number>>(new Set([17]));
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [done, setDone] = useState<'submitted' | 'expired' | null>(null);

  const answered = new Set(
    Object.entries(answers)
      .filter(([, v]) => v.trim())
      .map(([k]) => Number(k)),
  );

  function answer(value: string) {
    setAnswers(a => ({...a, [current]: value}));
    setSaveState('saving');
    setTimeout(() => setSaveState('saved'), 600);
  }

  return (
    <ExamRoom
      candidateName="Khải Hưng"
      testTitle="Practice Test 3 · Reading"
      {...clock}
      onExpire={() => setDone('expired')}
      onSubmit={() => setDone('submitted')}
      saveState={saveState}
      submitted={done !== null}
      parts={PARTS}
      current={current}
      answered={answered}
      flagged={flagged}
      onNavigate={setCurrent}
      onToggleReview={n =>
        setFlagged(f => {
          const next = new Set(f);
          if (!next.delete(n)) next.add(n);
          return next;
        })
      }
      partBar={
        <>
          <strong>{PARTS.find(p => p.questions.includes(current))?.title}</strong> &nbsp;Read the text and answer the
          questions.
        </>
      }
    >
      <div className="flex-1 overflow-y-auto p-5 sm:p-8">
        {done ? (
          <p className="font-semibold">{done === 'expired' ? 'Time is up. Submitting…' : 'Submitted.'}</p>
        ) : (
          <label className="flex max-w-xl flex-col gap-3">
            <span>
              <strong>Question {current}.</strong> Glassmaking changed after the ______ was invented.
            </span>
            <input
              className="h-11 rounded-md border bg-white px-3 text-black"
              value={answers[current] ?? ''}
              onChange={e => answer(e.target.value)}
            />
          </label>
        )}
      </div>
    </ExamRoom>
  );
}
