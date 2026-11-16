import {
  ApiErrorBody,
  DueSummaryResponseSchema,
  EndStudySessionRequestSchema,
  FlashcardSetIdParamsSchema,
  GetStudyCardsResponseSchema,
  ReviewCardRequestSchema,
  ReviewCardResponseSchema,
  StartStudySessionRequestSchema,
  StudySessionIdParamsSchema,
  StudySessionResponseSchema,
} from '@linmaster/shared';
import type {ZodType} from 'zod';
import {openApiRegistry} from '../../core/openapi-registry';

const SET_ID = '0192f7e0-0bcd-7000-8000-000000000021';
const CARD_ID = '0192f7e0-0bcd-7000-8000-000000000022';
const SESSION_ID = '0192f7e0-0bcd-7000-8000-000000000023';

const progressExample = {
  cardId: CARD_ID,
  easiness: 2.5,
  intervalDays: 6,
  repetitions: 2,
  lapses: 0,
  dueAt: '2026-11-16T03:00:00.000Z',
  lastReviewedAt: '2026-11-10T03:00:00.000Z',
  state: 'learning',
};
const sessionExample = {
  id: SESSION_ID,
  setId: SET_ID,
  mode: 'learn',
  startedAt: '2026-11-10T03:00:00.000Z',
  endedAt: null,
  cardsStudied: 0,
  correctCount: 0,
};

function json(schema: ZodType, example: unknown) {
  return {content: {'application/json': {schema, examples: {example: {value: example}}}}};
}

const error = (description: string) => ({description, content: {'application/json': {schema: ApiErrorBody}}});
const authError = error('Authentication required.');
const invalidError = error('Invalid request.');
const internalError = error('Unexpected server error.');
const security = [{bearerAuth: []}];

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/flashcards/sets/{id}/study',
  summary: 'Get the cards to study today',
  description:
    'Returns cards due before the end of today (Vietnam time, UTC+7), oldest due first and at most 200, ' +
    'followed by new cards in set order. At most 20 new cards per set are started per Vietnam day.',
  tags: ['Flashcard'],
  security,
  request: {params: FlashcardSetIdParamsSchema},
  responses: {
    200: {
      description: 'Cards for a learn session.',
      ...json(GetStudyCardsResponseSchema, {
        setId: SET_ID,
        cards: [
          {
            id: CARD_ID,
            term: 'mitigate',
            definition: 'giảm nhẹ',
            example: null,
            vocabEntryId: null,
            position: 0,
            createdAt: '2026-11-01T00:00:00.000Z',
            updatedAt: '2026-11-01T00:00:00.000Z',
            state: 'learning',
            progress: progressExample,
          },
        ],
        dueCount: 1,
        newCount: 0,
        newCardsPerDay: 20,
        newCardsRemaining: 20,
      }),
    },
    400: invalidError,
    401: authError,
    404: error('Flashcard set not found.'),
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/flashcards/reviews',
  summary: 'Rate a card and update its SM-2 schedule',
  description:
    'Again / Hard / Good / Easy map to SM-2 quality 2 / 3 / 4 / 5. Writes CardProgress and a ReviewLog. ' +
    'When `sessionId` is given it must be an open learn session of the same set.',
  tags: ['Flashcard'],
  security,
  request: {body: json(ReviewCardRequestSchema, {cardId: CARD_ID, rating: 'good', sessionId: SESSION_ID})},
  responses: {
    200: {description: 'New progress of the card.', ...json(ReviewCardResponseSchema, {progress: progressExample})},
    400: error('Invalid request, or the card is not in the set of the session.'),
    401: authError,
    404: error('Card or study session not found.'),
    409: error('The session has ended or is not a learn session.'),
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/flashcards/sessions',
  summary: 'Start a study session',
  description:
    'Opens a session of one mode (`flip`, `learn`, `test`, `match` or `exercise`) on a set of the user. Ratings ' +
    'sent with `POST /flashcards/reviews` and this `sessionId` count toward it; end it with `PATCH .../{id}`.',
  tags: ['Flashcard'],
  security,
  request: {body: json(StartStudySessionRequestSchema, {setId: SET_ID, mode: 'learn'})},
  responses: {
    201: {description: 'Session started.', ...json(StudySessionResponseSchema, {session: sessionExample})},
    400: invalidError,
    401: authError,
    404: error('Flashcard set not found.'),
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/flashcards/sessions/{id}',
  summary: 'End a study session',
  description:
    'Sets `endedAt`. Learn sessions count studied and correct cards from their ratings and ignore the body; ' +
    'other modes store the counts sent by the client.',
  tags: ['Flashcard'],
  security,
  request: {
    params: StudySessionIdParamsSchema,
    body: json(EndStudySessionRequestSchema, {cardsStudied: 12, correctCount: 9}),
  },
  responses: {
    200: {
      description: 'Session ended.',
      ...json(StudySessionResponseSchema, {
        session: {
          ...sessionExample,
          mode: 'flip',
          endedAt: '2026-11-10T03:10:00.000Z',
          cardsStudied: 12,
          correctCount: 9,
        },
      }),
    },
    400: invalidError,
    401: authError,
    404: error('Study session not found.'),
    409: error('The session has already ended.'),
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/flashcards/due-summary',
  summary: 'Count cards due today across all sets',
  description: 'For the home page. "Today" ends at midnight Vietnam time (UTC+7).',
  tags: ['Flashcard'],
  security,
  responses: {
    200: {
      description: 'Due cards per set, most due first.',
      ...json(DueSummaryResponseSchema, {
        dueCount: 18,
        sets: [{setId: SET_ID, title: 'Environment vocabulary', dueCount: 18}],
      }),
    },
    401: authError,
    500: internalError,
  },
});
