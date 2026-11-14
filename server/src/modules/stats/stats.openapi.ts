import {
  ApiErrorBody,
  StatsActivityQuerySchema,
  StatsActivityResponseSchema,
  StatsBandsResponseSchema,
  StatsOverviewResponseSchema,
  StatsVocabResponseSchema,
  StatsWeaknessesResponseSchema,
} from '@linmaster/shared';
import type {ZodType} from 'zod';

import {openApiRegistry} from '../../core/openapi-registry';

const ATTEMPT_ID = '0192f7e0-0bcd-7000-8000-000000000031';
const streak = {current: 3, longest: 9};

function json(schema: ZodType, example: unknown) {
  return {content: {'application/json': {schema, examples: {example: {value: example}}}}};
}

const error = (description: string) => ({description, content: {'application/json': {schema: ApiErrorBody}}});
const security = [{bearerAuth: []}];
const common = {
  401: error('Authentication required.'),
  500: error('Unexpected server error.'),
};
const ownOnly =
  "Only the signed-in user's own data; days are Vietnam days (UTC+7). A new account gets zeros and empty lists.";

function register(path: string, summary: string, description: string, schema: ZodType, example: unknown) {
  openApiRegistry.registerPath({
    method: 'get',
    path: `/api/v1/stats/${path}`,
    summary,
    description: `${description} ${ownOnly}`,
    tags: ['Stats'],
    security,
    responses: {200: {description: summary, ...json(schema, example)}, ...common},
  });
}

register(
  'overview',
  'Get the dashboard number cards',
  'Tests taken, best and latest band per skill, target band, words, mastered words, cards reviewed, study minutes and the study streak.',
  StatsOverviewResponseSchema,
  {
    testsTaken: 2,
    bands: {listening: {best: 6.5, latest: 6.5}, reading: {best: 7, latest: 6}},
    targetBand: 7.5,
    words: 10,
    masteredWords: 1,
    cardsReviewed: 24,
    studyMinutes: 135,
    streak,
  },
);

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/stats/activity',
  summary: 'Get the activity calendar',
  description:
    'Lookups, saved words, card reviews and submitted attempts per day, only days with activity. ' +
    `Without from and to: the 52 weeks ending today; at most 366 days. ${ownOnly}`,
  tags: ['Stats'],
  security,
  request: {query: StatsActivityQuerySchema},
  responses: {
    200: {
      description: 'Activity per day and the streak.',
      ...json(StatsActivityResponseSchema, {
        from: '2025-11-16',
        to: '2026-11-14',
        days: [{date: '2026-11-13', lookups: 4, savedWords: 2, reviews: 10, attempts: 1, total: 17}],
        streak,
      }),
    },
    400: error('Invalid date, or from after to, or more than 366 days.'),
    ...common,
  },
});

register(
  'bands',
  'Get the band trend',
  'Listening and Reading band of each submitted attempt, oldest first, with the target band.',
  StatsBandsResponseSchema,
  {
    targetBand: 7.5,
    points: [
      {
        attemptId: ATTEMPT_ID,
        testTitle: 'Sample Reading test',
        submittedAt: '2026-11-13T03:00:00.000Z',
        listening: null,
        reading: 6,
      },
    ],
  },
);

register(
  'vocab',
  'Get vocabulary growth',
  'Words added per week (last 12 weeks, Monday first), words per state and the 10 most used topics.',
  StatsVocabResponseSchema,
  {
    total: 10,
    states: {new: 6, learning: 3, mastered: 1},
    weekly: [{weekStart: '2026-11-09', added: 10}],
    topics: [{topic: 'environment', words: 4}],
  },
);

register(
  'weaknesses',
  'Get accuracy per question kind',
  'Accuracy per skill and question kind over submitted attempts, weakest first. weakest needs at least 5 answers.',
  StatsWeaknessesResponseSchema,
  {
    kinds: [{skill: 'reading', kind: 'tfng', answered: 6, correct: 3, accuracy: 0.5}],
    weakest: {skill: 'reading', kind: 'tfng'},
  },
);
