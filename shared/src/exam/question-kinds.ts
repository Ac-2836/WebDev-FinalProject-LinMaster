import {z} from 'zod';

import {matchesAcceptedText} from './answer-text';

/** Keys of the question kind registry, same values as the `QuestionKind` enum in the database. */
export const QuestionKindSchema = z.enum([
  'single_choice',
  'multi_choice',
  'tfng',
  'ynng',
  'matching',
  'completion',
  'short_answer',
  'diagram_label',
]);
export type QuestionKind = z.infer<typeof QuestionKindSchema>;

/** A learner's answer to one question as saved in `Attempt.state.answers`; `null` means left blank. */
export const GivenAnswerSchema = z.string().max(500).nullable();
export type GivenAnswer = z.infer<typeof GivenAnswerSchema>;

/** Group settings that change how a question is graded. */
export interface GradeContext {
  /** `QuestionGroup.wordLimit`, e.g. "NO MORE THAN TWO WORDS" → 2. */
  wordLimit?: number | null;
}

export interface GradeItem {
  given: GivenAnswer | undefined;
  /** `Question.answer`; validated against the kind's answer schema before grading. */
  answer: unknown;
}

/** One entry of the registry. The display component of each kind lives in the client registry. */
export interface QuestionKindDefinition {
  id: QuestionKind;
  /** Shape of `Question.answer`; parsing also brings the answer to its canonical form. */
  answerSchema: z.ZodType;
  /** Canonical form of a learner's answer, `null` when blank. */
  normalize(given: GivenAnswer | undefined): string | null;
  /** Grades the questions of one group in number order. */
  gradeGroup(items: readonly GradeItem[], context?: GradeContext): boolean[];
}

const explanation = z.string().trim().min(1).max(5000).optional();

/** Option keys: letters (`A`) or roman numerals of headings (`iv`), compared in upper case. */
export function normalizeChoice(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/^[\s.(),]+|[\s.(),]+$/gu, '')
    .toUpperCase();
}

const choiceKey = z.string().transform(normalizeChoice).pipe(z.string().min(1).max(10));
const typedAnswer = z.string().trim().min(1).max(200);

const JUDGEMENT_ALIASES: Readonly<Record<string, string>> = {
  T: 'TRUE',
  F: 'FALSE',
  Y: 'YES',
  N: 'NO',
  NG: 'NOT GIVEN',
  NOTGIVEN: 'NOT GIVEN',
};

/** `true`, `T`, ` not  given ` → `TRUE`, `TRUE`, `NOT GIVEN`. */
export function normalizeJudgement(value: string): string {
  const upper = value.normalize('NFKC').trim().replace(/\s+/gu, ' ').replace(/\.$/u, '').toUpperCase();
  return JUDGEMENT_ALIASES[upper] ?? upper;
}

function blankToNull(given: GivenAnswer | undefined, normalize: (value: string) => string): string | null {
  if (given === null || given === undefined) return null;
  const value = normalize(given);
  return value === '' ? null : value;
}

interface KindRules<A> {
  answerSchema: z.ZodType<A>;
  normalize(given: string): string;
  grade(given: string | null, answer: A, context: GradeContext): boolean;
  /** Overrides question-by-question grading when answers of a group depend on each other. */
  gradeGroup?(items: readonly {given: string | null; answer: A}[], context: GradeContext): boolean[];
}

function defineKind<A>(id: QuestionKind, rules: KindRules<A>): QuestionKindDefinition {
  const normalize = (given: GivenAnswer | undefined) => blankToNull(given, rules.normalize);
  return {
    id,
    answerSchema: rules.answerSchema,
    normalize,
    gradeGroup(items, context = {}) {
      const parsed = items.map(item => ({given: normalize(item.given), answer: rules.answerSchema.parse(item.answer)}));
      if (rules.gradeGroup) return rules.gradeGroup(parsed, context);
      return parsed.map(item => rules.grade(item.given, item.answer, context));
    },
  };
}

function judgementKind(id: QuestionKind, values: readonly [string, string, string]) {
  const valueSchema = z.preprocess(
    value => (typeof value === 'string' ? normalizeJudgement(value) : value),
    z.enum(values),
  );
  return defineKind(id, {
    answerSchema: z.object({value: valueSchema, explanation}).strict(),
    normalize: normalizeJudgement,
    grade: (given, answer) => given === answer.value,
  });
}

function choiceKind(id: QuestionKind) {
  return defineKind(id, {
    answerSchema: z.object({accepted: z.array(choiceKey).min(1).max(5), explanation}).strict(),
    normalize: normalizeChoice,
    grade: (given, answer) => given !== null && answer.accepted.includes(given),
  });
}

function textKind(id: QuestionKind) {
  return defineKind(id, {
    answerSchema: z.object({accepted: z.array(typedAnswer).min(1).max(20), explanation}).strict(),
    normalize: value => value.trim().replace(/\s+/gu, ' '),
    grade: (given, answer, context) => matchesAcceptedText(given, answer.accepted, context.wordLimit),
  });
}

/**
 * "Choose TWO letters" (questions 21–22): every question of the group stores the same `choices`, and each
 * question earns a mark for a correct letter in any order. A letter counts once, so `A, A` scores one mark.
 */
const multiChoice = defineKind('multi_choice', {
  answerSchema: z
    .object({
      choices: z
        .array(choiceKey)
        .min(2)
        .max(10)
        .refine(keys => new Set(keys).size === keys.length, {message: 'Choices must be unique.'}),
      explanation,
    })
    .strict(),
  normalize: normalizeChoice,
  grade: (given, answer) => given !== null && answer.choices.includes(given),
  gradeGroup(items) {
    const used = new Set<string>();
    return items.map(({given, answer}) => {
      if (given === null || used.has(given) || !answer.choices.includes(given)) return false;
      used.add(given);
      return true;
    });
  },
});

/** Question kind registry (PLAN B4, C4): add a kind by adding one entry. */
export const QUESTION_KINDS: Readonly<Record<QuestionKind, QuestionKindDefinition>> = {
  single_choice: choiceKind('single_choice'),
  multi_choice: multiChoice,
  tfng: judgementKind('tfng', ['TRUE', 'FALSE', 'NOT GIVEN']),
  ynng: judgementKind('ynng', ['YES', 'NO', 'NOT GIVEN']),
  matching: choiceKind('matching'),
  completion: textKind('completion'),
  short_answer: textKind('short_answer'),
  diagram_label: textKind('diagram_label'),
};

/** Validates and canonicalises a stored answer (`Question.answer`) for its kind. */
export function parseAnswer(kind: QuestionKind, answer: unknown) {
  return QUESTION_KINDS[kind].answerSchema.safeParse(answer);
}

/** Grades one question on its own. Use `gradeGroup` for a whole group so linked answers are scored right. */
export function gradeQuestion(kind: QuestionKind, item: GradeItem, context?: GradeContext): boolean {
  return QUESTION_KINDS[kind].gradeGroup([item], context)[0];
}

/** Grades the questions of one `QuestionGroup`, in number order. Throws a ZodError for an invalid answer. */
export function gradeGroup(kind: QuestionKind, items: readonly GradeItem[], context?: GradeContext): boolean[] {
  return QUESTION_KINDS[kind].gradeGroup(items, context);
}
