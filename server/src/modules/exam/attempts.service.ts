import {
  type Attempt,
  type AttemptAudio,
  type AttemptSectionTime,
  type AttemptState,
  AttemptStateSchema,
  EMPTY_ATTEMPT_STATE,
  type SaveAttemptStateResponse,
} from '@linmaster/shared';

import {AppError} from '../../core/app-error';
import type {AttemptRepository, AttemptRow} from './attempts.repository';
import type {TestContentRow, TestRepository} from './tests.repository';
import {toCandidateTest} from './tests.service';

export interface AttemptServiceDeps {
  attempts: AttemptRepository;
  tests: TestRepository;
  /** Server clock; tests pass a fixed one. */
  now?: () => Date;
}

const SECOND = 1000;

function notFound(): AppError {
  return new AppError('Attempt not found.', 404);
}

function expired(): AppError {
  return new AppError('Time is over; the attempt can no longer be saved.', 409, undefined, 'ATTEMPT_EXPIRED');
}

function submitted(): AppError {
  return new AppError('The attempt was already submitted.', 409, undefined, 'ATTEMPT_SUBMITTED');
}

/** Sections run one after another from `startedAt`, in exam order. */
function sectionTimes(startedAt: Date, test: TestContentRow): AttemptSectionTime[] {
  let start = startedAt.getTime();
  return test.content.map(section => {
    const startsAt = start;
    start += section.durationSec * SECOND;
    return {
      sectionId: section.id,
      skill: section.skill,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(start).toISOString(),
    };
  });
}

function readState(value: unknown): AttemptState {
  const parsed = AttemptStateSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_ATTEMPT_STATE;
}

function remainingSec(deadlineAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((deadlineAt.getTime() - now.getTime()) / SECOND));
}

export function createAttemptService({attempts, tests, now = () => new Date()}: AttemptServiceDeps) {
  /** The attempt of the user; another user's attempt answers 403. */
  async function ownAttempt(userId: string, attemptId: string): Promise<AttemptRow> {
    const attempt = await attempts.findAttempt(attemptId);
    if (!attempt) throw notFound();
    if (attempt.userId !== userId) throw new AppError('This attempt belongs to another user.', 403);
    return attempt;
  }

  /** Where the Listening audio is at `at`, by server time. */
  async function audioAt(attempt: AttemptRow, test: TestContentRow, section: AttemptSectionTime | undefined, at: Date) {
    const content = test.content.find(item => item.id === section?.sectionId);
    if (!section || !content || content.skill !== 'listening' || content.audioFileId === null) return null;
    const durationSec = await attempts.findAudioDurationSec(content.audioFileId);
    const elapsed = Math.floor((at.getTime() - Date.parse(section.startsAt)) / SECOND);
    const ended = durationSec !== null && elapsed >= durationSec;
    const audio: AttemptAudio = {
      sectionId: section.sectionId,
      streamPath: `/attempts/${attempt.id}/audio`,
      durationSec,
      positionSec: ended ? durationSec : elapsed,
      ended,
    };
    return audio;
  }

  async function toAttempt(attempt: AttemptRow, test: TestContentRow): Promise<Attempt> {
    const at = now();
    const sections = sectionTimes(attempt.startedAt, test);
    const running = attempt.status === 'in_progress' && at < attempt.deadlineAt;
    const current = running
      ? sections.find(
          section => Date.parse(section.startsAt) <= at.getTime() && at.getTime() < Date.parse(section.endsAt),
        )
      : undefined;
    return {
      id: attempt.id,
      testId: attempt.testId,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      deadlineAt: attempt.deadlineAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      autoSubmitted: attempt.autoSubmitted,
      serverNow: at.toISOString(),
      remainingSec: running ? remainingSec(attempt.deadlineAt, at) : 0,
      currentSectionId: current?.sectionId ?? null,
      sections,
      audio: await audioAt(attempt, test, current, at),
      state: readState(attempt.state),
      test: toCandidateTest(test),
    };
  }

  async function testOf(attempt: AttemptRow): Promise<TestContentRow> {
    const test = await tests.findTestContent(attempt.testId);
    if (!test) throw notFound();
    return test;
  }

  return {
    /**
     * `POST /attempts`: starts the test, own or public. An attempt already in progress on it is returned instead
     * (`created: false`). Attempts of other learners count in `Test.attemptCount`.
     */
    async createAttempt(userId: string, testId: string): Promise<{attempt: Attempt; created: boolean}> {
      const test = await tests.findTestContent(testId);
      if (!test || (test.ownerId !== userId && test.visibility !== 'public')) {
        throw new AppError('Test not found.', 404);
      }
      const existing = await attempts.findInProgress(userId, testId);
      if (existing) return {attempt: await toAttempt(existing, test), created: false};

      const startedAt = now();
      const durationSec = test.content.reduce((sum, section) => sum + section.durationSec, 0);
      const created = await attempts.createAttempt({
        userId,
        testId,
        startedAt,
        deadlineAt: new Date(startedAt.getTime() + durationSec * SECOND),
        state: EMPTY_ATTEMPT_STATE,
        countForTest: test.ownerId !== userId,
      });
      // Another request started the same test at the same moment: return its attempt.
      const attempt = created ?? (await attempts.findInProgress(userId, testId));
      if (!attempt) throw new AppError('The attempt could not be started.', 500);
      return {attempt: await toAttempt(attempt, test), created: created !== null};
    },

    /** `GET /attempts/:id`: owner only, with `serverNow`, the time left and the audio position. */
    async getAttempt(userId: string, attemptId: string): Promise<{attempt: Attempt}> {
      const attempt = await ownAttempt(userId, attemptId);
      return {attempt: await toAttempt(attempt, await testOf(attempt))};
    },

    /** `PUT /attempts/:id/state`: autosave, refused after the deadline or once submitted. */
    async saveState(userId: string, attemptId: string, state: AttemptState): Promise<SaveAttemptStateResponse> {
      const attempt = await ownAttempt(userId, attemptId);
      if (attempt.status === 'submitted') throw submitted();
      const at = now();
      if (at >= attempt.deadlineAt) throw expired();
      if (!(await attempts.saveState(attemptId, state, at))) {
        // Submitted between the read and the write.
        throw submitted();
      }
      return {
        savedAt: at.toISOString(),
        serverNow: at.toISOString(),
        remainingSec: remainingSec(attempt.deadlineAt, at),
      };
    },
  };
}

export type AttemptService = ReturnType<typeof createAttemptService>;
