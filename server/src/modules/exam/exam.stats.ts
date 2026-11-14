import type {QuestionKind, Skill} from '@linmaster/shared';

import {getDb} from '../../core/db';

export interface ExamStats {
  /** Submitted attempts, oldest first. */
  attempts: Array<{
    id: string;
    testTitle: string;
    startedAt: Date;
    submittedAt: Date;
    listeningBand: number | null;
    readingBand: number | null;
  }>;
  /** Answers of submitted attempts per skill and question kind. */
  kinds: Array<{skill: Skill; kind: QuestionKind; answered: number; correct: number}>;
}

/** Public API for the stats module: the user's submitted attempts and their answers per question kind. */
export async function getExamStats(userId: string): Promise<ExamStats> {
  const db = getDb();
  const submitted = {userId, status: 'submitted' as const};
  const [attempts, groups] = await Promise.all([
    db.attempt.findMany({
      where: {...submitted, submittedAt: {not: null}},
      orderBy: {submittedAt: 'asc'},
      select: {
        id: true,
        startedAt: true,
        submittedAt: true,
        listeningBand: true,
        readingBand: true,
        test: {select: {title: true}},
      },
    }),
    db.attemptAnswer.groupBy({
      by: ['skill', 'kind', 'isCorrect'],
      where: {attempt: submitted},
      _count: {_all: true},
    }),
  ]);

  const kinds = new Map<string, ExamStats['kinds'][number]>();
  for (const group of groups) {
    const key = `${group.skill}:${group.kind}`;
    const entry = kinds.get(key) ?? {skill: group.skill, kind: group.kind, answered: 0, correct: 0};
    entry.answered += group._count._all;
    if (group.isCorrect) entry.correct += group._count._all;
    kinds.set(key, entry);
  }
  return {
    attempts: attempts.map(row => ({
      id: row.id,
      testTitle: row.test.title,
      startedAt: row.startedAt,
      submittedAt: row.submittedAt!,
      listeningBand: row.listeningBand?.toNumber() ?? null,
      readingBand: row.readingBand?.toNumber() ?? null,
    })),
    kinds: [...kinds.values()],
  };
}
