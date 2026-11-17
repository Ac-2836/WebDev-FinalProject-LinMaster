import {EXERCISE_BLANK, type ExerciseKind, type ExerciseQuestion} from '@linmaster/shared';

import {isTypedCorrect} from './quiz-logic';

/** Dạng câu in the order the page asks them, as in an exam paper. */
export const KIND_ORDER: readonly ExerciseKind[] = ['single_choice', 'completion', 'matching'];

/** One thing to answer: a choice, a gap or one sentence of a matching question. `key` is where its answer is kept. */
export interface Unit {
  key: string;
  number: number;
  kind: ExerciseKind;
  /** Index of the question it belongs to in the list the server sent. */
  question: number;
  /** Sentence with the gap marked by `{{blank}}`. */
  prompt: string;
  options: string[];
  answer: string;
}

/** Every answer the learner must give, numbered 1, 2, 3… in the order the questions are shown (see `ordered`). */
export function unitsOf(questions: readonly ExerciseQuestion[]): Unit[] {
  const units: Unit[] = [];
  questions.forEach((q, question) => {
    const push = (prompt: string, options: string[], answer: string, part?: number) =>
      units.push({
        key: part === undefined ? String(question) : `${question}.${part}`,
        number: units.length + 1,
        kind: q.kind,
        question,
        prompt,
        options,
        answer,
      });
    if (q.kind === 'matching') q.items.forEach((item, i) => push(item.prompt, q.options, item.answer, i));
    else push(q.prompt, q.kind === 'single_choice' ? q.options : [], q.answer);
  });
  return units;
}

/** The questions grouped by kind in `KIND_ORDER`, keeping the server order inside a kind. */
export const ordered = (questions: readonly ExerciseQuestion[]): ExerciseQuestion[] =>
  KIND_ORDER.flatMap(kind => questions.filter(q => q.kind === kind));

/** The text before and after the first gap; null when the sentence has no gap. Further gaps become a line. */
export function splitBlank(prompt: string): {before: string; after: string} | null {
  const at = prompt.indexOf(EXERCISE_BLANK);
  if (at < 0) return null;
  return {
    before: prompt.slice(0, at),
    after: prompt.slice(at + EXERCISE_BLANK.length).replaceAll(EXERCISE_BLANK, '____'),
  };
}

/** Right or wrong for every unit, by key. A blank answer is wrong. */
export function grade(units: readonly Unit[], answers: Readonly<Record<string, string>>) {
  const results = Object.fromEntries(units.map(u => [u.key, isTypedCorrect(answers[u.key] ?? '', u.answer)]));
  return {results, correct: Object.values(results).filter(Boolean).length, total: units.length};
}

/** Kinds as the request wants them: unique and in `KIND_ORDER`. */
export const withKind = (kinds: readonly ExerciseKind[], kind: ExerciseKind, on: boolean): ExerciseKind[] =>
  KIND_ORDER.filter(k => (k === kind ? on : kinds.includes(k)));
