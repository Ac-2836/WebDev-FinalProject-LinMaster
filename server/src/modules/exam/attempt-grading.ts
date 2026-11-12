import {
  type AttemptState,
  getCertification,
  gradeGroup,
  parseAnswer,
  type QuestionKind,
  type Skill,
  type SkillScore,
  toBand,
} from '@linmaster/shared';

// Grading of a submitted attempt (PLAN C4): the kind registry grades each group, the band table of the
// certification turns the raw score of each skill into a band.

export interface AnswerKeyGroup {
  kind: QuestionKind;
  wordLimit: number | null;
  /** In number order. `answer` is the raw `Question.answer`. */
  questions: {id: string; number: number; answer: unknown}[];
}

export interface AnswerKeySection {
  skill: Skill;
  groups: AnswerKeyGroup[];
}

/** One `AttemptAnswer` row. `correctAnswer` is the snapshot of the answer at grading time. */
export interface GradedAnswer {
  questionId: string;
  questionNumber: number;
  skill: Skill;
  kind: QuestionKind;
  given: string | null;
  correctAnswer: unknown;
  isCorrect: boolean;
}

export interface GradedAttempt {
  answers: GradedAnswer[];
  /** One entry per skill of the test, in exam order. */
  scores: SkillScore[];
}

function givenOf(state: AttemptState, questionId: string): string | null {
  const given = state.answers[questionId];
  return typeof given === 'string' && given.trim() !== '' ? given : null;
}

/** Grades one group; an answer key that does not fit its kind scores 0 instead of failing the whole submit. */
function gradeOneGroup(skill: Skill, group: AnswerKeyGroup, state: AttemptState): GradedAnswer[] {
  const items = group.questions.map(question => ({given: givenOf(state, question.id), answer: question.answer}));
  let marks: boolean[];
  try {
    marks = gradeGroup(group.kind, items, {wordLimit: group.wordLimit});
  } catch {
    marks = items.map(() => false);
  }
  return group.questions.map((question, index) => {
    const parsed = parseAnswer(group.kind, question.answer);
    return {
      questionId: question.id,
      questionNumber: question.number,
      skill,
      kind: group.kind,
      given: items[index].given,
      correctAnswer: parsed.success ? parsed.data : (question.answer ?? {}),
      isCorrect: marks[index],
    };
  });
}

/** Grades every question of the test against the saved state. */
export function gradeAttempt(
  certification: string,
  sections: readonly AnswerKeySection[],
  state: AttemptState,
): GradedAttempt {
  const spec = getCertification(certification);
  const answers = sections.flatMap(section =>
    section.groups.flatMap(group => gradeOneGroup(section.skill, group, state)),
  );
  const skills = [...new Set(sections.map(section => section.skill))];
  const scores = skills.map(skill => {
    const ofSkill = answers.filter(answer => answer.skill === skill);
    const correct = ofSkill.filter(answer => answer.isCorrect).length;
    const max = spec?.sections[skill].questionCount ?? 0;
    return {skill, correct, total: ofSkill.length, band: spec ? toBand(spec, skill, Math.min(correct, max)) : 0};
  });
  return {answers, scores};
}

/**
 * Accepted answers of a snapshot as written in the key, for the result page: `{value}` → `[value]`,
 * `{accepted}` → `accepted`, `{choices}` → `choices`.
 */
export function correctTexts(snapshot: unknown): string[] {
  if (typeof snapshot !== 'object' || snapshot === null) return [];
  const {value, accepted, choices} = snapshot as Record<string, unknown>;
  if (typeof value === 'string') return [value];
  const list = Array.isArray(accepted) ? accepted : Array.isArray(choices) ? choices : [];
  return list.filter((item): item is string => typeof item === 'string');
}

/** The explanation from the uploaded files, kept in the snapshot. */
export function explanationOf(snapshot: unknown): string | null {
  if (typeof snapshot !== 'object' || snapshot === null) return null;
  const {explanation} = snapshot as Record<string, unknown>;
  return typeof explanation === 'string' ? explanation : null;
}
