import {
  ApiErrorBody,
  AttemptIdParamsSchema,
  CreateAttemptRequestSchema,
  CreateAttemptResponseSchema,
  ExplainQuestionParamsSchema,
  ExplainQuestionQuerySchema,
  ExplainQuestionResponseSchema,
  GetAttemptResponseSchema,
  GetAttemptResultResponseSchema,
  ListAttemptsResponseSchema,
  SaveAttemptStateRequestSchema,
  SaveAttemptStateResponseSchema,
  SubmitAttemptResponseSchema,
} from '@linmaster/shared';
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

/** Responses of every endpoint on one attempt. */
export const ATTEMPT_ERRORS = {
  400: error('Invalid attempt id or body.'),
  401: error('Authentication required.'),
  403: error('The attempt belongs to another user.'),
  404: error('Attempt not found.'),
  500: error('Unexpected server error.'),
};

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/attempts/{id}',
  summary: 'Get an attempt',
  description:
    'Owner only. `serverNow`, `remainingSec` and the audio position come from the server clock, so a refresh ' +
    'keeps the timer and the audio where they were. The test never holds answers, explanations or transcripts. ' +
    'An attempt past its deadline is submitted first (lazy submit).',
  tags: ['Exam'],
  security,
  request: {params: AttemptIdParamsSchema},
  responses: {
    200: {description: 'The attempt.', content: json(GetAttemptResponseSchema, {attempt: ATTEMPT_EXAMPLE})},
    ...ATTEMPT_ERRORS,
  },
});

openApiRegistry.registerPath({
  method: 'put',
  path: '/api/v1/attempts/{id}/state',
  summary: 'Autosave an attempt',
  description: 'Owner only. Replaces the saved answers, highlights, notes, flags and position.',
  tags: ['Exam'],
  security,
  request: {
    params: AttemptIdParamsSchema,
    body: {content: json(SaveAttemptStateRequestSchema, {state: ATTEMPT_EXAMPLE.state})},
  },
  responses: {
    200: {
      description: 'State saved.',
      content: json(SaveAttemptStateResponseSchema, {
        savedAt: ATTEMPT_EXAMPLE.serverNow,
        serverNow: ATTEMPT_EXAMPLE.serverNow,
        remainingSec: ATTEMPT_EXAMPLE.remainingSec,
      }),
    },
    ...ATTEMPT_ERRORS,
    409: error('`ATTEMPT_EXPIRED`: the deadline passed. `ATTEMPT_SUBMITTED`: the attempt was submitted.'),
  },
});

/** A submitted Listening test; `correct` lists the accepted answers of the key. */
export const RESULT_EXAMPLE = {
  id: ID(71),
  testId: ID(61),
  testTitle: 'Cambridge 18 Listening Test 1',
  testKind: 'listening',
  status: 'submitted',
  startedAt: '2026-11-13T03:00:00.000Z',
  deadlineAt: '2026-11-13T03:32:00.000Z',
  submittedAt: '2026-11-13T03:31:10.000Z',
  autoSubmitted: false,
  scores: [{skill: 'listening', correct: 31, total: 40, band: 7}],
  questions: [
    {
      questionId: ID(73),
      number: 1,
      skill: 'listening',
      kind: 'completion',
      given: 'libary',
      correct: ['library'],
      isCorrect: false,
      explanation: 'The woman says they will meet "outside the library".',
    },
  ],
  transcripts: [
    {sectionId: ID(72), passageId: ID(74), title: 'Part 1', paragraphs: [{label: 'Woman', text: 'Shall we meet…'}]},
  ],
};

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/attempts/{id}/submit',
  summary: 'Submit an attempt',
  description:
    'Owner only. Grades every question, snapshots the answer key (`AttemptAnswer`) and turns each raw score into ' +
    'a band. Calling it again returns the same result; after the deadline the attempt counts as `autoSubmitted`.',
  tags: ['Exam'],
  security,
  request: {params: AttemptIdParamsSchema},
  responses: {
    200: {description: 'The result.', content: json(SubmitAttemptResponseSchema, {result: RESULT_EXAMPLE})},
    ...ATTEMPT_ERRORS,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/attempts/{id}/result',
  summary: 'Get the result of an attempt',
  description:
    'Owner only, once submitted; an attempt past its deadline is submitted first. Holds the accepted answers, ' +
    'the explanations from the uploaded files and the Listening transcripts.',
  tags: ['Exam'],
  security,
  request: {params: AttemptIdParamsSchema},
  responses: {
    200: {description: 'The result.', content: json(GetAttemptResultResponseSchema, {result: RESULT_EXAMPLE})},
    ...ATTEMPT_ERRORS,
    409: error('`ATTEMPT_NOT_SUBMITTED`: the attempt is still in progress.'),
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/attempts',
  summary: 'List my attempts',
  description: 'Attempts of the user, newest first; `scores` is empty until submitted.',
  tags: ['Exam'],
  security,
  responses: {
    200: {
      description: 'Attempts of the user.',
      content: json(ListAttemptsResponseSchema, {
        attempts: [{...RESULT_EXAMPLE, questions: undefined, transcripts: undefined}],
      }),
    },
    401: error('Authentication required.'),
    500: error('Unexpected server error.'),
  },
});

const audioBytes = (description: string) => ({
  description,
  content: {
    'audio/mpeg': {schema: {type: 'string' as const, format: 'binary'}},
    'audio/mp4': {schema: {type: 'string' as const, format: 'binary'}},
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/attempts/{id}/audio',
  summary: 'Stream the Listening audio of an attempt',
  description:
    'Owner only, while the Listening section runs and its audio is playing (`attempt.audio`). Answers with ' +
    '`206` and only the bytes up to the server-time position + 30 seconds, so the audio cannot be downloaded ' +
    'ahead or skipped forward; `Range` asks for a start byte. `Cache-Control: no-store`.',
  tags: ['Exam'],
  security,
  request: {params: AttemptIdParamsSchema},
  responses: {
    206: audioBytes('Audio bytes; `Content-Range` tells which.'),
    ...ATTEMPT_ERRORS,
    409: error('`AUDIO_NOT_AVAILABLE`: no Listening audio is playing in the attempt now.'),
    416: audioBytes('The asked range starts after the bytes played so far.'),
  },
});

const EXPLAIN_EXAMPLES = {
  ai: {
    summary: 'No explanation in the file: explained by the AI',
    value: {
      explanation: {
        number: 1,
        skill: 'reading',
        source: 'ai',
        text: 'Đoạn A nói nông trại được trồng trên mái nhà, nên đáp án là A.',
        evidence: [{passageId: ID(74), paragraph: 0, start: 0, end: 20, quote: 'Farms grow on roofs.'}],
      },
    },
  },
  file: {
    summary: 'Explanation written in the answer file: the AI is not called',
    value: {
      explanation: {
        number: 1,
        skill: 'listening',
        source: 'file',
        text: 'The woman says they will meet "outside the library".',
        evidence: [],
      },
    },
  },
};

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/attempts/{id}/questions/{no}/explain',
  summary: 'Explain the answer of one question',
  description:
    'Owner only, once the attempt is submitted. When the answer file has an explanation for the question it is ' +
    'returned as it is (`source: "file"`, no AI call, no quota). Otherwise the AI task `explain-answer.v1` explains ' +
    'the key from the passage (Reading) or transcript (Listening) of the question (`source: "ai"`; the client shows ' +
    '"Do AI tạo, có thể chưa chính xác"). `evidence` holds quotes the server found in that text, with `passageId`, ' +
    '`paragraph` and `start`/`end` character offsets to highlight; quotes the model invented are dropped. Results are ' +
    'cached per question and answer given, and a cached call does not use the daily AI quota. `no` is the number ' +
    'inside its skill: a Full test has the same number in Listening and Reading, so add `?skill=`.',
  tags: ['Exam'],
  security,
  request: {params: ExplainQuestionParamsSchema, query: ExplainQuestionQuerySchema},
  responses: {
    200: {
      description: 'The explanation.',
      content: {'application/json': {schema: ExplainQuestionResponseSchema, examples: EXPLAIN_EXAMPLES}},
    },
    400: error('Invalid id or number, or the number exists in both skills and `skill` is missing.'),
    401: error('Authentication required.'),
    403: error('The attempt belongs to another user.'),
    404: error('Attempt or question not found.'),
    409: error('`ATTEMPT_NOT_SUBMITTED`: the attempt is still in progress.'),
    422: error('`EXPLAIN_NO_TEXT`: the question has no passage or transcript text to explain from.'),
    429: error('`AI_QUOTA_EXCEEDED` (daily quota) or too many AI requests in a minute.'),
    502: error('`AI_INVALID_OUTPUT`: the model answered with an invalid result three times.'),
    503: error('`AI_UNAVAILABLE`: the model could not be reached.'),
    500: error(
      'Unexpected server error. `AI_REQUEST_REJECTED`: the AI refused the request (a bug in our schema, prompt or key), so trying again will not help.',
    ),
  },
});
