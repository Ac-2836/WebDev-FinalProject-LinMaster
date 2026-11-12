'use client';

import type {QuestionKind} from '@linmaster/shared';
import {cn} from 'cn';
import {useId} from 'react';

import {
  JUDGEMENTS,
  multiChoiceSelected,
  overWordLimit,
  splitBlank,
  toggleMultiChoice,
  type Answers,
  type ExamGroup,
  type ExamOption,
  type ExamQuestion,
  type Struck,
} from './reading-logic';

export interface GroupViewProps {
  group: ExamGroup;
  answers: Answers;
  current: number;
  onAnswer: (patch: Record<number, string | null>) => void;
  struck: Struck;
  onStrike: (question: number, key: string) => void;
  onFocusQuestion: (question: number) => void;
}

const inputClass =
  'h-11 rounded-md border border-black/30 bg-white px-3 text-black outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

function QuestionBlock({
  number,
  label = String(number),
  current,
  onFocusQuestion,
  children,
}: {
  number: number;
  label?: string;
  current: boolean;
  onFocusQuestion: (n: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      id={`q-${number}`}
      onFocusCapture={() => onFocusQuestion(number)}
      className={cn('-m-2 flex scroll-mt-4 items-start gap-3 rounded-lg p-2', current && 'ring-2 ring-primary')}
    >
      <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded border-2 border-current px-1 font-bold">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">{children}</div>
    </div>
  );
}

/** Radio or checkbox options; right-click (or the context menu key) crosses an option out. */
function ChoiceList({
  number,
  options,
  type = 'radio',
  isChecked,
  onToggle,
  isDisabled,
  struck,
  onStrike,
}: {
  number: number;
  options: {key: string; label: string}[];
  type?: 'radio' | 'checkbox';
  isChecked: (key: string) => boolean;
  onToggle: (key: string) => void;
  isDisabled?: (key: string) => boolean;
  struck: Struck;
  onStrike: (question: number, key: string) => void;
}) {
  const name = useId();
  return (
    <div role={type === 'radio' ? 'radiogroup' : 'group'} aria-label={`Question ${number}`} className="flex flex-col">
      {options.map(({key, label}) => {
        const crossed = struck[number]?.includes(key);
        return (
          <label
            key={key}
            onContextMenu={e => {
              e.preventDefault();
              onStrike(number, key);
            }}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1',
              crossed && 'opacity-60 line-through decoration-2',
            )}
          >
            <input
              type={type}
              name={name}
              className="size-4 shrink-0 accent-primary"
              checked={isChecked(key)}
              disabled={isDisabled?.(key)}
              onChange={() => onToggle(key)}
              aria-describedby={crossed ? `${name}-crossed` : undefined}
            />
            <span>{label}</span>
          </label>
        );
      })}
      <span id={`${name}-crossed`} className="sr-only">
        crossed out
      </span>
    </div>
  );
}

const optionLabel = (o: ExamOption) => (o.text ? `${o.key}  ${o.text}` : o.key);

function TextAnswer({
  number,
  value,
  wordLimit,
  onAnswer,
  className,
  label = `Answer ${number}`,
}: {
  number: number;
  value: string | null | undefined;
  wordLimit?: number | null;
  onAnswer: GroupViewProps['onAnswer'];
  className?: string;
  label?: string;
}) {
  const over = overWordLimit(value, wordLimit);
  const hint = `q-${number}-limit`;
  return (
    <span className="inline-flex flex-col gap-1 align-baseline">
      <input
        className={cn(inputClass, 'w-44 font-sans', over && 'border-warning', className)}
        aria-label={label}
        aria-invalid={over || undefined}
        aria-describedby={over ? hint : undefined}
        autoComplete="off"
        spellCheck={false}
        value={value ?? ''}
        onChange={e => onAnswer({[number]: e.target.value === '' ? null : e.target.value})}
      />
      {over && (
        <span id={hint} className="font-sans text-[0.85em] font-semibold text-warning">
          More than {wordLimit} {wordLimit === 1 ? 'word' : 'words'}
        </span>
      )}
    </span>
  );
}

function SingleChoice({group, answers, current, onAnswer, struck, onStrike, onFocusQuestion}: GroupViewProps) {
  return group.questions.map(q => (
    <QuestionBlock key={q.number} number={q.number} current={current === q.number} onFocusQuestion={onFocusQuestion}>
      <p>{q.prompt}</p>
      <ChoiceList
        number={q.number}
        options={(q.options ?? group.sharedOptions ?? []).map(o => ({key: o.key, label: optionLabel(o)}))}
        isChecked={key => answers[q.number] === key}
        onToggle={key => onAnswer({[q.number]: key})}
        struck={struck}
        onStrike={onStrike}
      />
    </QuestionBlock>
  ));
}

function MultiChoice({group, answers, current, onAnswer, struck, onStrike, onFocusQuestion}: GroupViewProps) {
  const numbers = group.questions.map(q => q.number);
  const first = group.questions[0];
  if (!first) return null;
  const selected = multiChoiceSelected(numbers, answers);
  const full = selected.length >= numbers.length;
  return (
    <QuestionBlock
      number={first.number}
      label={`${group.fromNo}–${group.toNo}`}
      current={numbers.includes(current)}
      onFocusQuestion={onFocusQuestion}
    >
      <p>{first.prompt}</p>
      <ChoiceList
        number={first.number}
        type="checkbox"
        options={(first.options ?? group.sharedOptions ?? []).map(o => ({key: o.key, label: optionLabel(o)}))}
        isChecked={key => selected.includes(key)}
        isDisabled={key => full && !selected.includes(key)}
        onToggle={key => {
          const patch = toggleMultiChoice(numbers, answers, key);
          if (patch) onAnswer(patch);
        }}
        struck={struck}
        onStrike={onStrike}
      />
      <p className="text-[0.85em] text-current/70">
        {selected.length} of {numbers.length} chosen
      </p>
    </QuestionBlock>
  );
}

function Judgement({group, answers, current, onAnswer, struck, onStrike, onFocusQuestion}: GroupViewProps) {
  const values = JUDGEMENTS[group.kind] ?? [];
  return group.questions.map(q => (
    <QuestionBlock key={q.number} number={q.number} current={current === q.number} onFocusQuestion={onFocusQuestion}>
      <p>{q.prompt}</p>
      <ChoiceList
        number={q.number}
        options={values.map(v => ({key: v, label: v}))}
        isChecked={key => answers[q.number] === key}
        onToggle={key => onAnswer({[q.number]: key})}
        struck={struck}
        onStrike={onStrike}
      />
    </QuestionBlock>
  ));
}

function OptionBox({title, options}: {title: string; options: ExamOption[]}) {
  return (
    <div className="rounded-lg border border-current/30 p-4">
      <p className="mb-2 font-bold">{title}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {options.map(o => (
          <div key={o.key} className="contents">
            <dt className="font-bold">{o.key}</dt>
            <dd>{o.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Matching({group, answers, current, onAnswer, onFocusQuestion}: GroupViewProps) {
  const options = group.sharedOptions ?? [];
  return (
    <>
      {options.some(o => o.text) && <OptionBox title="List of options" options={options} />}
      {group.questions.map(q => (
        <QuestionBlock
          key={q.number}
          number={q.number}
          current={current === q.number}
          onFocusQuestion={onFocusQuestion}
        >
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 basis-48">{q.prompt}</p>
            <select
              className={cn(inputClass, 'w-24 px-2')}
              aria-label={`Answer ${q.number}`}
              value={answers[q.number] ?? ''}
              onChange={e => onAnswer({[q.number]: e.target.value || null})}
            >
              <option value="" />
              {(q.options ?? options).map(o => (
                <option key={o.key} value={o.key}>
                  {o.key}
                </option>
              ))}
            </select>
          </div>
        </QuestionBlock>
      ))}
    </>
  );
}

function Completion({group, answers, current, onAnswer, onFocusQuestion}: GroupViewProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-current/30 p-4 font-serif leading-loose">
      {group.questions.map(q => {
        const parts = splitBlank(q.prompt);
        const input = (
          <TextAnswer number={q.number} value={answers[q.number]} wordLimit={group.wordLimit} onAnswer={onAnswer} />
        );
        return (
          <p
            key={q.number}
            id={`q-${q.number}`}
            onFocusCapture={() => onFocusQuestion(q.number)}
            className={cn('-m-1 scroll-mt-4 rounded-md p-1', current === q.number && 'ring-2 ring-primary')}
          >
            {parts ? parts[0] : `${q.prompt} `}
            <span className="font-sans font-bold">{q.number}</span> {input}
            {parts?.[1]}
          </p>
        );
      })}
    </div>
  );
}

function ShortAnswer({group, answers, current, onAnswer, onFocusQuestion}: GroupViewProps) {
  return (
    <>
      {group.imageUrl && (
        // Diagram from the test file; its labels are the questions below.
        <img src={group.imageUrl} alt={`Diagram for questions ${group.fromNo}–${group.toNo}`} className="max-w-full" />
      )}
      {group.questions.map((q: ExamQuestion) => (
        <QuestionBlock
          key={q.number}
          number={q.number}
          current={current === q.number}
          onFocusQuestion={onFocusQuestion}
        >
          <p>{q.prompt}</p>
          <TextAnswer
            number={q.number}
            value={answers[q.number]}
            wordLimit={group.wordLimit}
            onAnswer={onAnswer}
            className="w-full max-w-72"
          />
        </QuestionBlock>
      ))}
    </>
  );
}

/** Client side of the question kind registry (`QUESTION_KINDS` in shared/exam): one view per kind. */
export const QUESTION_VIEWS: Record<QuestionKind, (props: GroupViewProps) => React.ReactNode> = {
  single_choice: SingleChoice,
  multi_choice: MultiChoice,
  tfng: Judgement,
  ynng: Judgement,
  matching: Matching,
  completion: Completion,
  short_answer: ShortAnswer,
  diagram_label: ShortAnswer,
};

export function QuestionGroupView(props: GroupViewProps) {
  const {group} = props;
  const View = QUESTION_VIEWS[group.kind];
  return (
    <section aria-labelledby={`g-${group.fromNo}`} className="flex flex-col gap-4">
      <h2 id={`g-${group.fromNo}`} className="font-bold">
        Questions {group.fromNo}
        {group.toNo !== group.fromNo && `–${group.toNo}`}
      </h2>
      <p className="whitespace-pre-line">{group.instructions}</p>
      <View {...props} />
    </section>
  );
}
