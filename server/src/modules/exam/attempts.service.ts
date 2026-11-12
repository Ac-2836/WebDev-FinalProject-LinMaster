import {type Attempt, AttemptStateSchema, EMPTY_ATTEMPT_STATE} from '@linmaster/shared';

import {AppError} from '../../core/app-error';
import {audioPosition, clockSections, currentSection, deadlineOf, remainingSec, sectionTimes} from './attempt-clock';
import type {AttemptRepository, AttemptRow} from './attempts.repository';
import type {TestContentRow, TestRepository} from './tests.repository';
import {toCandidateTest} from './tests.service';

export interface AttemptServiceDeps {
  attempts: AttemptRepository;
  tests: TestRepository;
  /** Server clock; tests pass a fixed one. */
  now?: () => Date;
}

export function createAttemptService({attempts, tests, now = () => new Date()}: AttemptServiceDeps) {
  /** The attempt at `now` by server time: time left, running section and Listening audio position. */
  async function toAttempt(attempt: AttemptRow, test: TestContentRow): Promise<Attempt> {
    const at = now();
    const sections = sectionTimes(attempt.startedAt, clockSections(test.certification, test.content));
    const running = attempt.status === 'in_progress' && at < attempt.deadlineAt;
    const current = running ? currentSection(sections, at) : undefined;
    const content = test.content.find(section => section.id === current?.sectionId);
    let audio: Attempt['audio'] = null;
    if (current && content?.skill === 'listening' && content.audioFileId !== null) {
      const durationSec = await attempts.findAudioDurationSec(content.audioFileId);
      const streamPath = `/attempts/${attempt.id}/audio`;
      audio = {sectionId: current.sectionId, streamPath, durationSec, ...audioPosition(current, durationSec, at)};
    }
    const state = AttemptStateSchema.safeParse(attempt.state);
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
      audio,
      state: state.success ? state.data : EMPTY_ATTEMPT_STATE,
      test: toCandidateTest(test),
    };
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
      const created = await attempts.createAttempt({
        userId,
        testId,
        startedAt,
        deadlineAt: deadlineOf(startedAt, clockSections(test.certification, test.content)),
        state: EMPTY_ATTEMPT_STATE,
        countForTest: test.ownerId !== userId,
      });
      // Another request started the same test at the same moment: return its attempt.
      const attempt = created ?? (await attempts.findInProgress(userId, testId));
      if (!attempt) throw new AppError('The attempt could not be started.', 500);
      return {attempt: await toAttempt(attempt, test), created: created !== null};
    },
  };
}

export type AttemptService = ReturnType<typeof createAttemptService>;
