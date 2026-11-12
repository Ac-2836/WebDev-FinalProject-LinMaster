import {
  type CandidateSection,
  type CandidateTest,
  ChoiceOptionSchema,
  GroupSharedSchema,
  ParsedParagraphSchema,
  type TestSummary,
  type UpdateTestRequest,
} from '@linmaster/shared';
import {z} from 'zod';

import {AppError} from '../../core/app-error';
import type {TestContentRow, TestRepository, TestRow} from './tests.repository';

const ParagraphsSchema = z.array(ParsedParagraphSchema);
const OptionsSchema = z.array(ChoiceOptionSchema);

/** Parses a jsonb column; unknown keys are dropped and a value of the wrong shape becomes null. */
function parseJson<T>(schema: z.ZodType<T>, value: unknown): T | null {
  if (value === null || value === undefined) return null;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toSummary(row: TestRow): TestSummary {
  return {
    id: row.id,
    certification: row.certification,
    kind: row.kind,
    title: row.title,
    source: row.source,
    visibility: row.visibility,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    attemptCount: row.attemptCount,
    skills: row.sections.map(section => section.skill),
    questionCount: row.sections.reduce((sum, section) => sum + section.questionCount, 0),
    durationSec: row.sections.reduce((sum, section) => sum + section.durationSec, 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Builds the candidate view field by field: answers are never read, Listening transcripts are dropped and the jsonb
 * columns go through their schemas, so nothing extra stored in them (e.g. an explanation) reaches the client.
 */
function toCandidateSections(content: TestContentRow['content']): CandidateSection[] {
  return content.map(section => ({
    id: section.id,
    skill: section.skill,
    position: section.position,
    durationSec: section.durationSec,
    hasAudio: section.audioFileId !== null,
    passages: section.passages.map(passage => ({
      id: passage.id,
      position: passage.position,
      title: passage.title,
      paragraphs: section.skill === 'reading' ? parseJson(ParagraphsSchema, passage.paragraphs) : null,
      audioStartSec: passage.audioStartSec,
      groups: passage.groups.map(group => ({
        id: group.id,
        kind: group.kind,
        fromNo: group.fromNo,
        toNo: group.toNo,
        instructions: group.instructions,
        wordLimit: group.wordLimit,
        shared: parseJson(GroupSharedSchema, group.sharedOptions),
        questions: group.questions.map(question => ({
          id: question.id,
          number: question.number,
          prompt: question.prompt,
          options: parseJson(OptionsSchema, question.options),
        })),
      })),
    })),
  }));
}

export function createTestService(repository: TestRepository) {
  return {
    /** `GET /tests`: tests of the user. */
    async listTests(userId: string): Promise<{tests: TestSummary[]}> {
      return {tests: (await repository.listTests(userId)).map(toSummary)};
    },

    /** `GET /tests/:id`: the owner, or anyone for a public test. Private and hidden tests of others answer 404. */
    async getTest(userId: string, testId: string): Promise<{test: CandidateTest}> {
      const row = await repository.findTestContent(testId);
      if (!row || (row.ownerId !== userId && row.visibility !== 'public')) throw new AppError('Test not found.', 404);
      return {test: {...toSummary(row), sections: toCandidateSections(row.content)}};
    },

    /** `PATCH /tests/:id`: title and source, owner only. */
    async updateTest(userId: string, testId: string, data: UpdateTestRequest): Promise<{test: TestSummary}> {
      const row = await repository.updateTest(userId, testId, data);
      if (!row) throw new AppError('Test not found.', 404);
      return {test: toSummary(row)};
    },

    /** `DELETE /tests/:id`: owner only, and only while no other learner took the test. */
    async deleteTest(userId: string, testId: string): Promise<{deleted: true}> {
      const result = await repository.deleteTest(userId, testId);
      if (result === 'missing') throw new AppError('Test not found.', 404);
      if (result === 'has_attempts') {
        throw new AppError(
          'Other learners took this test, so it cannot be deleted. Unpublish it from the library instead.',
          409,
          undefined,
          'TEST_HAS_ATTEMPTS',
        );
      }
      return {deleted: true};
    },
  };
}

export type TestService = ReturnType<typeof createTestService>;
