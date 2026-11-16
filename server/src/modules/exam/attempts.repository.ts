import type {AttemptState, AttemptStatus, QuestionKind, Skill, TestKind} from '@linmaster/shared';

import {getDb} from '../../core/db';
import {Prisma} from '../../generated/prisma/client';
import type {AnswerKeySection, GradedAttempt} from './attempt-grading';

/** A row of `Attempt`. `state` is the raw jsonb column, checked by the service. */
export interface AttemptRow {
  id: string;
  userId: string;
  testId: string;
  status: AttemptStatus;
  startedAt: Date;
  deadlineAt: Date;
  submittedAt: Date | null;
  autoSubmitted: boolean;
  state: unknown;
}

export interface NewAttempt {
  userId: string;
  testId: string;
  startedAt: Date;
  deadlineAt: Date;
  state: AttemptState;
  /** Attempt of another learner than the owner: counted in `Test.attemptCount`. */
  countForTest: boolean;
}

/** An attempt with its test and scores, for the history; `answers` only tells the skill of each graded question. */
export interface AttemptSummaryRow extends AttemptRow {
  test: {title: string; kind: TestKind};
  listeningCorrect: number | null;
  readingCorrect: number | null;
  listeningBand: number | null;
  readingBand: number | null;
  answers: {skill: Skill}[];
}

/** A submitted attempt with its graded answers, for the result page. */
export interface AttemptResultRow extends AttemptSummaryRow {
  answers: {
    questionId: string | null;
    questionNumber: number;
    skill: Skill;
    kind: QuestionKind;
    given: unknown;
    correctAnswer: unknown;
    isCorrect: boolean;
  }[];
}

/** A Listening part with its raw transcript (`Passage.paragraphs`). */
export interface TranscriptRow {
  sectionId: string;
  passageId: string;
  title: string;
  paragraphs: unknown;
}

/** One graded answer with the question it was for; `question` is null once the question was deleted. */
export interface QuestionContextRow {
  questionNumber: number;
  skill: Skill;
  kind: QuestionKind;
  given: unknown;
  correctAnswer: unknown;
  question: {
    prompt: string;
    options: unknown;
    group: {
      instructions: string;
      sharedOptions: unknown;
      passage: {id: string; title: string; paragraphs: unknown};
    };
  } | null;
}

export interface SubmittedAttempt {
  submittedAt: Date;
  autoSubmitted: boolean;
  graded: GradedAttempt;
}

export interface AttemptRepository {
  findAttempt(attemptId: string): Promise<AttemptRow | null>;
  findInProgress(userId: string, testId: string): Promise<AttemptRow | null>;
  /** Null when the user already has an attempt in progress on the test (unique index). */
  createAttempt(attempt: NewAttempt): Promise<AttemptRow | null>;
  /** Saves only while the attempt is in progress and `now` is before the deadline; false otherwise. */
  saveState(attemptId: string, state: AttemptState, now: Date): Promise<boolean>;
  /** Questions with their answers, in exam order; only for grading, never sent to a candidate. */
  findAnswerKey(testId: string): Promise<AnswerKeySection[]>;
  /** Writes the grades once: false when the attempt was already submitted. */
  submitAttempt(attemptId: string, submitted: SubmittedAttempt): Promise<boolean>;
  findResult(attemptId: string): Promise<AttemptResultRow | null>;
  /** Attempts of the user, newest first. */
  listAttempts(userId: string): Promise<AttemptSummaryRow[]>;
  findTranscripts(testId: string): Promise<TranscriptRow[]>;
  /** Graded answers with this number: two when a Full test has it in both skills and `skill` is not given. */
  findQuestionContexts(attemptId: string, number: number, skill?: Skill): Promise<QuestionContextRow[]>;
  /** Length of a Listening audio file, null when unknown. */
  findAudioDurationSec(fileId: string): Promise<number | null>;
  findAudioFile(fileId: string): Promise<{storageKey: string; mimeType: string; durationSec: number | null} | null>;
}

export const ATTEMPT_SELECT = {
  id: true,
  userId: true,
  testId: true,
  status: true,
  startedAt: true,
  deadlineAt: true,
  submittedAt: true,
  autoSubmitted: true,
  state: true,
} as const;

const ORDERED = {orderBy: {position: 'asc'}} as const;
const RESULT_SELECT = {
  ...ATTEMPT_SELECT,
  test: {select: {title: true, kind: true}},
  listeningCorrect: true,
  readingCorrect: true,
  listeningBand: true,
  readingBand: true,
} as const;

const toNumber = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export const prismaAttemptRepository: AttemptRepository = {
  async findAttempt(attemptId) {
    return getDb().attempt.findUnique({where: {id: attemptId}, select: ATTEMPT_SELECT});
  },

  async findInProgress(userId, testId) {
    return getDb().attempt.findFirst({where: {userId, testId, status: 'in_progress'}, select: ATTEMPT_SELECT});
  },

  async createAttempt({countForTest, ...data}) {
    try {
      return await getDb().$transaction(async tx => {
        const attempt = await tx.attempt.create({data, select: ATTEMPT_SELECT});
        if (countForTest) await tx.test.update({where: {id: data.testId}, data: {attemptCount: {increment: 1}}});
        return attempt;
      });
    } catch (error) {
      if (hasPrismaCode(error, 'P2002')) return null;
      throw error;
    }
  },

  async saveState(attemptId, state, now) {
    const {count} = await getDb().attempt.updateMany({
      where: {id: attemptId, status: 'in_progress', deadlineAt: {gt: now}},
      data: {state},
    });
    return count > 0;
  },

  async findAnswerKey(testId) {
    const sections = await getDb().testSection.findMany({
      where: {testId},
      ...ORDERED,
      select: {
        skill: true,
        passages: {
          ...ORDERED,
          select: {
            groups: {
              ...ORDERED,
              select: {
                kind: true,
                wordLimit: true,
                questions: {orderBy: {number: 'asc'}, select: {id: true, number: true, answer: true}},
              },
            },
          },
        },
      },
    });
    return sections.map(({skill, passages}) => ({skill, groups: passages.flatMap(passage => passage.groups)}));
  },

  async submitAttempt(attemptId, {submittedAt, autoSubmitted, graded}) {
    const score = (skill: Skill) => graded.scores.find(item => item.skill === skill);
    return getDb().$transaction(async tx => {
      const {count} = await tx.attempt.updateMany({
        where: {id: attemptId, status: 'in_progress'},
        data: {
          status: 'submitted',
          submittedAt,
          autoSubmitted,
          listeningCorrect: score('listening')?.correct ?? null,
          readingCorrect: score('reading')?.correct ?? null,
          listeningBand: score('listening')?.band ?? null,
          readingBand: score('reading')?.band ?? null,
        },
      });
      if (count === 0) return false;
      await tx.attemptAnswer.createMany({
        data: graded.answers.map(({given, correctAnswer, ...answer}) => ({
          ...answer,
          attemptId,
          given: given ?? Prisma.DbNull,
          correctAnswer: correctAnswer as Prisma.InputJsonValue,
        })),
      });
      return true;
    });
  },

  async findResult(attemptId) {
    const attempt = await getDb().attempt.findUnique({
      where: {id: attemptId},
      select: {
        ...RESULT_SELECT,
        answers: {
          orderBy: [{skill: 'asc'}, {questionNumber: 'asc'}],
          select: {
            questionId: true,
            questionNumber: true,
            skill: true,
            kind: true,
            given: true,
            correctAnswer: true,
            isCorrect: true,
          },
        },
      },
    });
    if (!attempt) return null;
    return {...attempt, listeningBand: toNumber(attempt.listeningBand), readingBand: toNumber(attempt.readingBand)};
  },

  async listAttempts(userId) {
    const attempts = await getDb().attempt.findMany({
      where: {userId},
      orderBy: {startedAt: 'desc'},
      select: {...RESULT_SELECT, answers: {select: {skill: true}}},
    });
    return attempts.map(attempt => ({
      ...attempt,
      listeningBand: toNumber(attempt.listeningBand),
      readingBand: toNumber(attempt.readingBand),
    }));
  },

  async findTranscripts(testId) {
    const passages = await getDb().passage.findMany({
      where: {section: {testId, skill: 'listening'}},
      orderBy: [{section: {position: 'asc'}}, {position: 'asc'}],
      select: {id: true, sectionId: true, title: true, paragraphs: true},
    });
    return passages.map(({id, ...passage}) => ({passageId: id, ...passage}));
  },

  async findQuestionContexts(attemptId, number, skill) {
    return getDb().attemptAnswer.findMany({
      where: {attemptId, questionNumber: number, ...(skill && {skill})},
      select: {
        questionNumber: true,
        skill: true,
        kind: true,
        given: true,
        correctAnswer: true,
        question: {
          select: {
            prompt: true,
            options: true,
            group: {
              select: {
                instructions: true,
                sharedOptions: true,
                passage: {select: {id: true, title: true, paragraphs: true}},
              },
            },
          },
        },
      },
    });
  },

  async findAudioFile(fileId) {
    return getDb().storedFile.findUnique({
      where: {id: fileId},
      select: {storageKey: true, mimeType: true, durationSec: true},
    });
  },

  async findAudioDurationSec(fileId) {
    const file = await getDb().storedFile.findUnique({where: {id: fileId}, select: {durationSec: true}});
    return file?.durationSec ?? null;
  },
};
