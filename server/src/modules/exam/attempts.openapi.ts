import {
  ApiErrorBody,
  AttemptIdParamsSchema,
  CreateAttemptRequestSchema,
  CreateAttemptResponseSchema,
  GetAttemptResponseSchema,
  SaveAttemptStateRequestSchema,
  SaveAttemptStateResponseSchema,
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

const ATTEMPT_ID = '0192f7e0-0bcd-7000-8000-000000000071';
const SECTION_ID = '0192f7e0-0bcd-7000-8000-000000000072';
const QUESTION_ID = '0192f7e0-0bcd-7000-8000-000000000073';

const STATE = {
  answers: {[QUESTION_ID]: 'library'},
  highlights: [],
  notes: [],
  flags: [QUESTION_ID],
  position: {sectionId: SECTION_ID, questionId: QUESTION_ID},
};

const ATTEMPT = {
  id: ATTEMPT_ID,
  testId: '0192f7e0-0bcd-7000-8000-000000000061',
  status: 'in_progress',
  startedAt: '2026-11-13T03:00:00.000Z',
  deadlineAt: '2026-11-13T03:30:00.000Z',
  submittedAt: null,
  autoSubmitted: false,
  serverNow: '2026-11-13T03:05:00.000Z',
  remainingSec: 1500,
  currentSectionId: SECTION_ID,
  sections: [
    {
      sectionId: SECTION_ID,
      skill: 'listening',
      startsAt: '2026-11-13T03:00:00.000Z',
      endsAt: '2026-11-13T03:30:00.000Z',
    },
  ],
  audio: {
    sectionId: SECTION_ID,
    streamPath: `/attempts/${ATTEMPT_ID}/audio`,
    durationSec: 1680,
    positionSec: 300,
    ended: false,
  },
  state: STATE,
  test: {
    id: '0192f7e0-0bcd-7000-8000-000000000061',
    certification: 'IELTS_ACADEMIC',
    kind: 'listening',
    title: 'Cambridge 18 Listening Test 1',
    source: null,
    visibility: 'private',
    publishedAt: null,
    attemptCount: 0,
    skills: ['listening'],
    questionCount: 40,
    durationSec: 1800,
    createdAt: '2026-11-12T03:10:00.000Z',
    updatedAt: '2026-11-12T03:10:00.000Z',
    sections: [
      {
        id: SECTION_ID,
        skill: 'listening',
        position: 1,
        durationSec: 1800,
        hasAudio: true,
        passages: [],
      },
    ],
  },
};

const ownerOnly = {
  403: error('The attempt belongs to another user.'),
  404: error('Attempt not found.'),
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
  request: {body: {content: json(CreateAttemptRequestSchema, {testId: ATTEMPT.testId})}},
  responses: {
    200: {
      description: 'The attempt already in progress.',
      content: json(CreateAttemptResponseSchema, {attempt: ATTEMPT}),
    },
    201: {description: 'Attempt started.', content: json(CreateAttemptResponseSchema, {attempt: ATTEMPT})},
    400: error('Invalid body.'),
    401: error('Authentication required.'),
    404: error('Test not found, or private to another user.'),
    500: error('Unexpected server error.'),
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/attempts/{id}',
  summary: 'Get an attempt',
  description:
    'Owner only. `serverNow`, `remainingSec` and the audio position come from the server clock, so a refresh ' +
    'keeps the timer and the audio where they were. The test never holds answers, explanations or transcripts.',
  tags: ['Exam'],
  security,
  request: {params: AttemptIdParamsSchema},
  responses: {
    200: {description: 'The attempt.', content: json(GetAttemptResponseSchema, {attempt: ATTEMPT})},
    400: error('Invalid attempt id.'),
    401: error('Authentication required.'),
    ...ownerOnly,
    500: error('Unexpected server error.'),
  },
});

openApiRegistry.registerPath({
  method: 'put',
  path: '/api/v1/attempts/{id}/state',
  summary: 'Autosave an attempt',
  description: 'Owner only. Replaces the saved answers, highlights, notes, flags and position.',
  tags: ['Exam'],
  security,
  request: {params: AttemptIdParamsSchema, body: {content: json(SaveAttemptStateRequestSchema, {state: STATE})}},
  responses: {
    200: {
      description: 'State saved.',
      content: json(SaveAttemptStateResponseSchema, {
        savedAt: ATTEMPT.serverNow,
        serverNow: ATTEMPT.serverNow,
        remainingSec: 1500,
      }),
    },
    400: error('Invalid id or state.'),
    401: error('Authentication required.'),
    ...ownerOnly,
    409: error('`ATTEMPT_EXPIRED`: the deadline passed. `ATTEMPT_SUBMITTED`: the attempt was submitted.'),
    500: error('Unexpected server error.'),
  },
});
