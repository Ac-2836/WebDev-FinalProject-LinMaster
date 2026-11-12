import {ApiErrorBody, CreateAttemptRequestSchema, CreateAttemptResponseSchema} from '@linmaster/shared';
import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi';
import {z} from 'zod';

import {openApiRegistry} from '../../core/openapi-registry';
import {CANDIDATE_TEST} from './tests.openapi';

extendZodWithOpenApi(z);

export const error = (description: string) => ({
  description,
  content: {'application/json': {schema: ApiErrorBody}},
});
export const security = [{bearerAuth: []}];
export const json = (schema: z.ZodType, value: unknown) => ({
  'application/json': {schema, examples: {example: {value}}},
});

const ID = (n: number) => `0192f7e0-0bcd-7000-8000-0000000000${n}`;

/** A Reading attempt 5 minutes in; a Listening one also has `audio` (see `AttemptAudioSchema`). */
export const ATTEMPT_EXAMPLE = {
  id: ID(71),
  testId: CANDIDATE_TEST.id,
  status: 'in_progress',
  startedAt: '2026-11-13T03:00:00.000Z',
  deadlineAt: '2026-11-13T04:00:00.000Z',
  submittedAt: null,
  autoSubmitted: false,
  serverNow: '2026-11-13T03:05:00.000Z',
  remainingSec: 3300,
  currentSectionId: ID(62),
  sections: [
    {sectionId: ID(62), skill: 'reading', startsAt: '2026-11-13T03:00:00.000Z', endsAt: '2026-11-13T04:00:00.000Z'},
  ],
  audio: null,
  state: {
    answers: {[ID(65)]: 'FALSE'},
    highlights: [{passageId: ID(63), paragraph: 0, start: 3, end: 8}],
    notes: [],
    flags: [ID(65)],
    position: {sectionId: ID(62), questionId: ID(65)},
  },
  test: CANDIDATE_TEST,
};

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/attempts',
  summary: 'Start a test',
  description:
    'Starts an own or `public` test; `deadlineAt` = server time + the duration of the sections. ' +
    'When the user already has an attempt in progress on the test, that attempt is returned (200).',
  tags: ['Exam'],
  security,
  request: {body: {content: json(CreateAttemptRequestSchema, {testId: CANDIDATE_TEST.id})}},
  responses: {
    200: {
      description: 'The attempt in progress.',
      content: json(CreateAttemptResponseSchema, {attempt: ATTEMPT_EXAMPLE}),
    },
    201: {description: 'Attempt started.', content: json(CreateAttemptResponseSchema, {attempt: ATTEMPT_EXAMPLE})},
    400: error('Invalid body.'),
    401: error('Authentication required.'),
    404: error('Test not found, or private to another user.'),
    500: error('Unexpected server error.'),
  },
});
