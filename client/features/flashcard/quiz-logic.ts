import type {QuizQuestion} from '@linmaster/shared';

/** Lower case, single spaces, no punctuation at the ends: "  Mitigate. " matches "mitigate". */
export const normalizeAnswer = (text: string) =>
  text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:!?"'“”‘’()-]+|[\s.,;:!?"'“”‘’()-]+$/g, '');

/** A typed answer is right when it matches the card's term after normalising both. */
export const isTypedCorrect = (typed: string, answer: string) => {
  const given = normalizeAnswer(typed);
  return given !== '' && given === normalizeAnswer(answer);
};

/** What the learner sees as the right answer for a question, for the "wrong answers" list. */
export function correctAnswer(
  question: QuizQuestion,
): {kind: 'text'; text: string} | {kind: 'boolean'; value: boolean} {
  return question.kind === 'true-false'
    ? {kind: 'boolean', value: question.answer}
    : {kind: 'text', text: question.answer};
}

/** Score as a whole percentage of the questions asked. */
export const percent = (correct: number, total: number) => (total === 0 ? 0 : Math.round((correct / total) * 100));
