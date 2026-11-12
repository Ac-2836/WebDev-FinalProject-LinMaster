import {
  type Attempt,
  type AttemptResult,
  type AttemptState,
  type AttemptSummary,
  AttemptStateSchema,
  EMPTY_ATTEMPT_STATE,
  GivenAnswerSchema,
  ParsedParagraphSchema,
  type SaveAttemptStateResponse,
  type SkillScore,
} from '@linmaster/shared';
import {z} from 'zod';

import {AppError} from '../../core/app-error';
import type {Storage} from '../../core/storage';
import {audioPosition, clockSections, currentSection, deadlineOf, remainingSec, sectionTimes} from './attempt-clock';
import {correctTexts, explanationOf, gradeAttempt} from './attempt-grading';
import type {AttemptRepository, AttemptRow, AttemptSummaryRow} from './attempts.repository';
import type {TestContentRow, TestRepository} from './tests.repository';
import {toCandidateTest} from './tests.service';

export interface AttemptServiceDeps {
  attempts: AttemptRepository;
  tests: TestRepository;
  storage: Storage;
  /** Server clock; tests pass a fixed one. */
  now?: () => Date;
}

const ParagraphsSchema = z.array(ParsedParagraphSchema);

/** Audio sent ahead of the server-time position, so playback does not stall between two range requests. */
export const AUDIO_LEAD_SEC = 30;

export interface AudioChunk {
  status: 206 | 416;
  mimeType: string;
  /** Value of `Content-Range`. */
  range: string;
  body: Buffer;
}

/** `bytes=start-end` → the first byte asked; a suffix range (`bytes=-500`) counts from the end. */
function rangeStart(header: string | undefined, size: number): number {
  const match = header ? /^bytes=(\d*)-(\d*)$/u.exec(header.trim()) : null;
  if (!match) return 0;
  if (match[1] === '') return match[2] === '' ? 0 : Math.max(0, size - Number(match[2]));
  return Number(match[1]);
}

/** Scores kept on the attempt; `total` is the number of graded questions of the skill. */
function scoresOf(row: AttemptSummaryRow): SkillScore[] {
  const columns = {
    listening: [row.listeningCorrect, row.listeningBand],
    reading: [row.readingCorrect, row.readingBand],
  } as const;
  return (['listening', 'reading'] as const).flatMap(skill => {
    const [correct, band] = columns[skill];
    if (correct === null || band === null) return [];
    return [{skill, correct, band, total: row.answers.filter(answer => answer.skill === skill).length}];
  });
}

function toSummary(row: AttemptSummaryRow): AttemptSummary {
  return {
    id: row.id,
    testId: row.testId,
    testTitle: row.test.title,
    testKind: row.test.kind,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    deadlineAt: row.deadlineAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    autoSubmitted: row.autoSubmitted,
    scores: scoresOf(row),
  };
}

export function createAttemptService({attempts, tests, storage, now = () => new Date()}: AttemptServiceDeps) {
  /** The attempt of the user; another user's attempt answers 403. */
  async function ownAttempt(userId: string, attemptId: string): Promise<AttemptRow> {
    const attempt = await attempts.findAttempt(attemptId);
    if (!attempt) throw new AppError('Attempt not found.', 404);
    if (attempt.userId !== userId) throw new AppError('This attempt belongs to another user.', 403);
    return attempt;
  }

  async function testOf(testId: string): Promise<TestContentRow> {
    const test = await tests.findTestContent(testId);
    if (!test) throw new AppError('Test not found.', 404);
    return test;
  }

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

  /** Grades the attempt once; a second call (or a concurrent one) leaves the first result in place. */
  async function submit(attempt: AttemptRow, certification: string): Promise<void> {
    if (attempt.status === 'submitted') return;
    const at = now();
    const autoSubmitted = at >= attempt.deadlineAt;
    const state = AttemptStateSchema.safeParse(attempt.state);
    const graded = gradeAttempt(
      certification,
      await attempts.findAnswerKey(attempt.testId),
      state.success ? state.data : EMPTY_ATTEMPT_STATE,
    );
    await attempts.submitAttempt(attempt.id, {
      submittedAt: autoSubmitted ? attempt.deadlineAt : at,
      autoSubmitted,
      graded,
    });
  }

  /** Lazy submit: an attempt past its deadline is submitted when it is next read. */
  async function settle(attempt: AttemptRow, certification: string): Promise<AttemptRow> {
    if (attempt.status !== 'in_progress' || now() < attempt.deadlineAt) return attempt;
    await submit(attempt, certification);
    return (await attempts.findAttempt(attempt.id)) ?? attempt;
  }

  /** Result of a submitted attempt, with the explanations from the files and the Listening transcripts. */
  async function resultOf(attemptId: string): Promise<AttemptResult> {
    const row = await attempts.findResult(attemptId);
    if (!row) throw new AppError('Attempt not found.', 404);
    const transcripts = await attempts.findTranscripts(row.testId);
    return {
      ...toSummary(row),
      questions: row.answers.map(answer => {
        const given = GivenAnswerSchema.safeParse(answer.given);
        return {
          questionId: answer.questionId,
          number: answer.questionNumber,
          skill: answer.skill,
          kind: answer.kind,
          given: given.success ? given.data : null,
          correct: correctTexts(answer.correctAnswer),
          isCorrect: answer.isCorrect,
          explanation: explanationOf(answer.correctAnswer),
        };
      }),
      transcripts: transcripts.flatMap(({paragraphs, ...passage}) => {
        const parsed = ParagraphsSchema.safeParse(paragraphs);
        return parsed.success && parsed.data.length > 0 ? [{...passage, paragraphs: parsed.data}] : [];
      }),
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
      if (existing && (await settle(existing, test.certification)).status === 'in_progress') {
        return {attempt: await toAttempt(existing, test), created: false};
      }

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

    /** `GET /attempts/:id`: owner only, with `serverNow`, the time left and the audio position. */
    async getAttempt(userId: string, attemptId: string): Promise<{attempt: Attempt}> {
      const attempt = await ownAttempt(userId, attemptId);
      const test = await testOf(attempt.testId);
      return {attempt: await toAttempt(await settle(attempt, test.certification), test)};
    },

    /** `PUT /attempts/:id/state`: autosave, refused after the deadline or once submitted. */
    async saveState(userId: string, attemptId: string, state: AttemptState): Promise<SaveAttemptStateResponse> {
      const attempt = await ownAttempt(userId, attemptId);
      const at = now();
      const submitted = new AppError('The attempt was already submitted.', 409, undefined, 'ATTEMPT_SUBMITTED');
      if (attempt.status === 'submitted') throw submitted;
      if (at >= attempt.deadlineAt) {
        throw new AppError('Time is over; the attempt can no longer be saved.', 409, undefined, 'ATTEMPT_EXPIRED');
      }
      // The deadline was checked above, so a refused write means the attempt was submitted in between.
      if (!(await attempts.saveState(attemptId, state, at))) throw submitted;
      const savedAt = at.toISOString();
      return {savedAt, serverNow: savedAt, remainingSec: remainingSec(attempt.deadlineAt, at)};
    },

    /** `POST /attempts/:id/submit`: grades the attempt; calling again returns the same result. */
    async submitAttempt(userId: string, attemptId: string): Promise<{result: AttemptResult}> {
      const attempt = await ownAttempt(userId, attemptId);
      await submit(attempt, (await testOf(attempt.testId)).certification);
      return {result: await resultOf(attemptId)};
    },

    /** `GET /attempts/:id/result`: owner only, once submitted (an attempt past its deadline is submitted first). */
    async getResult(userId: string, attemptId: string): Promise<{result: AttemptResult}> {
      const owned = await ownAttempt(userId, attemptId);
      const attempt = await settle(owned, (await testOf(owned.testId)).certification);
      if (attempt.status !== 'submitted') {
        throw new AppError('Submit the attempt to see its result.', 409, undefined, 'ATTEMPT_NOT_SUBMITTED');
      }
      return {result: await resultOf(attemptId)};
    },

    /**
     * `GET /attempts/:id/audio`: owner only, while the Listening section runs and its audio is playing. Only the
     * bytes up to the server-time position (+ AUDIO_LEAD_SEC) are sent: the audio cannot be downloaded ahead or
     * skipped forward. The room plays it without controls, so it cannot be paused either.
     */
    async streamAudio(userId: string, attemptId: string, range: string | undefined): Promise<AudioChunk> {
      const attempt = await ownAttempt(userId, attemptId);
      const test = await testOf(attempt.testId);
      const at = now();
      const unavailable = () =>
        new AppError('No audio is playing in this attempt now.', 409, undefined, 'AUDIO_NOT_AVAILABLE');
      if (attempt.status !== 'in_progress' || at >= attempt.deadlineAt) throw unavailable();
      const current = currentSection(
        sectionTimes(attempt.startedAt, clockSections(test.certification, test.content)),
        at,
      );
      const section = test.content.find(item => item.id === current?.sectionId);
      if (!current || section?.skill !== 'listening' || section.audioFileId === null) throw unavailable();
      const file = await attempts.findAudioFile(section.audioFileId);
      const data = file && (await storage.get(file.storageKey));
      if (!file || !data) throw unavailable();
      const {positionSec, ended} = audioPosition(current, file.durationSec, at);
      if (ended) throw unavailable();

      const size = data.length;
      const ratio = file.durationSec ? Math.min(1, (positionSec + AUDIO_LEAD_SEC) / file.durationSec) : 1;
      const last = Math.max(0, Math.floor(size * ratio) - 1);
      const start = rangeStart(range, size);
      if (start > last) return {status: 416, mimeType: file.mimeType, range: `bytes */${size}`, body: Buffer.alloc(0)};
      return {
        status: 206,
        mimeType: file.mimeType,
        range: `bytes ${start}-${last}/${size}`,
        body: data.subarray(start, last + 1),
      };
    },

    /** `GET /attempts`: attempts of the user, newest first. */
    async listAttempts(userId: string): Promise<{attempts: AttemptSummary[]}> {
      return {attempts: (await attempts.listAttempts(userId)).map(toSummary)};
    },
  };
}

export type AttemptService = ReturnType<typeof createAttemptService>;
