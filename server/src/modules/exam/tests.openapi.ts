import {
  ApiErrorBody,
  DeleteTestResponseSchema,
  GetTestResponseSchema,
  ListTestsResponseSchema,
  TestIdParamsSchema,
  UpdateTestRequestSchema,
  UpdateTestResponseSchema,
} from '@linmaster/shared';
import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi';
import {z} from 'zod';

import {openApiRegistry} from '../../core/openapi-registry';

extendZodWithOpenApi(z);

const error = (description: string) => ({description, content: {'application/json': {schema: ApiErrorBody}}});
const security = [{bearerAuth: []}];
const json = (schema: z.ZodType, value: unknown) => ({
  'application/json': {schema, examples: {example: {value}}},
});

const SUMMARY = {
  id: '0192f7e0-0bcd-7000-8000-000000000061',
  certification: 'IELTS_ACADEMIC',
  kind: 'reading',
  title: 'Cambridge 18 Reading Test 1',
  source: 'Cambridge IELTS 18',
  visibility: 'private',
  publishedAt: null,
  attemptCount: 0,
  skills: ['reading'],
  questionCount: 40,
  durationSec: 3600,
  createdAt: '2026-11-13T03:10:00.000Z',
  updatedAt: '2026-11-13T03:10:00.000Z',
};

const CANDIDATE_TEST = {
  ...SUMMARY,
  sections: [
    {
      id: '0192f7e0-0bcd-7000-8000-000000000062',
      skill: 'reading',
      position: 1,
      durationSec: 3600,
      hasAudio: false,
      passages: [
        {
          id: '0192f7e0-0bcd-7000-8000-000000000063',
          position: 1,
          title: 'Urban farming',
          paragraphs: [{label: 'A', text: 'In Paris, urban farmers are…'}],
          audioStartSec: null,
          groups: [
            {
              id: '0192f7e0-0bcd-7000-8000-000000000064',
              kind: 'tfng',
              fromNo: 1,
              toNo: 1,
              instructions: 'Do the following statements agree with the information given in Reading Passage 1?',
              wordLimit: null,
              shared: null,
              questions: [
                {
                  id: '0192f7e0-0bcd-7000-8000-000000000065',
                  number: 1,
                  prompt: 'Urban farms are found only in Paris.',
                  options: null,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/tests',
  summary: 'List my tests',
  description: 'Tests the user owns, newest first.',
  tags: ['Exam'],
  security,
  responses: {
    200: {description: 'Tests of the user.', content: json(ListTestsResponseSchema, {tests: [SUMMARY]})},
    401: error('Authentication required.'),
    500: error('Unexpected server error.'),
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/tests/{id}',
  summary: 'Get a test for a candidate',
  description:
    'The owner, or anyone for a `public` test. **Never** holds answers, explanations or Listening transcripts ' +
    '(`paragraphs` is null for Listening parts); they come with the result of a submitted attempt.',
  tags: ['Exam'],
  security,
  request: {params: TestIdParamsSchema},
  responses: {
    200: {description: 'The test without answers.', content: json(GetTestResponseSchema, {test: CANDIDATE_TEST})},
    400: error('Invalid test id.'),
    401: error('Authentication required.'),
    404: error('Test not found, or private to another user.'),
    500: error('Unexpected server error.'),
  },
});

openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/tests/{id}',
  summary: 'Rename a test or change its source',
  tags: ['Exam'],
  security,
  request: {
    params: TestIdParamsSchema,
    body: {content: json(UpdateTestRequestSchema, {title: 'Cambridge 18 Reading Test 1'})},
  },
  responses: {
    200: {description: 'Test updated.', content: json(UpdateTestResponseSchema, {test: SUMMARY})},
    400: error('Invalid id or body.'),
    401: error('Authentication required.'),
    404: error('Test not found among the tests of the user.'),
    500: error('Unexpected server error.'),
  },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/tests/{id}',
  summary: 'Delete a test',
  description: 'Owner only. A test other learners took cannot be deleted; unpublish it from the library instead.',
  tags: ['Exam'],
  security,
  request: {params: TestIdParamsSchema},
  responses: {
    200: {description: 'Test deleted.', content: json(DeleteTestResponseSchema, {deleted: true})},
    400: error('Invalid test id.'),
    401: error('Authentication required.'),
    404: error('Test not found among the tests of the user.'),
    409: error('`TEST_HAS_ATTEMPTS`: other learners took the test (`attemptCount > 0`).'),
    500: error('Unexpected server error.'),
  },
});
