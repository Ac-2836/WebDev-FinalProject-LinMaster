import type {AttemptState, AttemptStatus} from '@linmaster/shared';

import {getDb} from '../../core/db';

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

export interface AttemptRepository {
  findAttempt(attemptId: string): Promise<AttemptRow | null>;
  findInProgress(userId: string, testId: string): Promise<AttemptRow | null>;
  /** Null when the user already has an attempt in progress on the test (unique index). */
  createAttempt(attempt: NewAttempt): Promise<AttemptRow | null>;
  /** Saves only while the attempt is in progress and `now` is before the deadline; false otherwise. */
  saveState(attemptId: string, state: AttemptState, now: Date): Promise<boolean>;
  /** Length of a Listening audio file, null when unknown. */
  findAudioDurationSec(fileId: string): Promise<number | null>;
}

const ATTEMPT = {
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

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export const prismaAttemptRepository: AttemptRepository = {
  async findAttempt(attemptId) {
    return getDb().attempt.findUnique({where: {id: attemptId}, select: ATTEMPT});
  },

  async findInProgress(userId, testId) {
    return getDb().attempt.findFirst({where: {userId, testId, status: 'in_progress'}, select: ATTEMPT});
  },

  async createAttempt({countForTest, ...data}) {
    try {
      return await getDb().$transaction(async tx => {
        const attempt = await tx.attempt.create({data, select: ATTEMPT});
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

  async findAudioDurationSec(fileId) {
    const file = await getDb().storedFile.findUnique({where: {id: fileId}, select: {durationSec: true}});
    return file?.durationSec ?? null;
  },
};
