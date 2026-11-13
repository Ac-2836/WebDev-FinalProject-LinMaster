import type {QuestionKind, ResultQuestion, SkillScore} from '@linmaster/shared';

/** Mean band of the skills, rounded to the nearest half band like an IELTS overall score; null before grading. */
export function overallBand(scores: readonly SkillScore[]): number | null {
  if (!scores.length) return null;
  const mean = scores.reduce((sum, s) => sum + s.band, 0) / scores.length;
  return Math.round(mean * 2) / 2;
}

/** Share of correct answers per question kind, weakest first. */
export function kindAccuracy(questions: readonly ResultQuestion[]) {
  const byKind = new Map<QuestionKind, {correct: number; total: number}>();
  for (const q of questions) {
    const row = byKind.get(q.kind) ?? {correct: 0, total: 0};
    row.total++;
    if (q.isCorrect) row.correct++;
    byKind.set(q.kind, row);
  }
  return [...byKind]
    .map(([kind, {correct, total}]) => ({kind, correct, total, percent: Math.round((correct / total) * 100)}))
    .sort((a, b) => a.percent - b.percent);
}

/** Whole minutes between two ISO times, at least 1. */
export const minutesBetween = (from: string, to: string) =>
  Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));

/** What a learner wrote, as shown in the table; null for a blank. */
export const givenText = (given: string | null) => (given && given.trim() ? given : null);
