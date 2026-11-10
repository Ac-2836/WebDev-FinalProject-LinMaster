import {
  ApiErrorBody,
  CreateFlashcardSetFromVocabSchema,
  CreateFlashcardSetResponseSchema,
  CreateFlashcardSetSchema,
  DeleteFlashcardSetResponseSchema,
  FlashcardSetIdParamsSchema,
  GetFlashcardSetResponseSchema,
  ListFlashcardSetsResponseSchema,
  ReplaceFlashcardCardsRequestSchema,
  ReplaceFlashcardCardsResponseSchema,
  UpdateFlashcardSetSchema,
} from '@linmaster/shared';
import type {ZodType} from 'zod';
import {openApiRegistry} from '../../core/openapi-registry';

const exampleSet = {
  id: '0192f7e0-0bcd-7000-8000-000000000021',
  title: 'Environment vocabulary',
  description: 'Words from the reading list.',
  termLang: 'en',
  definitionLang: 'vi',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  cards: [
    {
      id: '0192f7e0-0bcd-7000-8000-000000000022',
      term: 'mitigate',
      definition: 'giảm nhẹ',
      example: 'The policy mitigated the impact.',
      vocabEntryId: null,
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

function requestBody(schema: ZodType, name: string, value: unknown) {
  return {content: {'application/json': {schema, examples: {[name]: {summary: 'Example request', value}}}}};
}

const authError = {description: 'Authentication required.', content: {'application/json': {schema: ApiErrorBody}}};
const invalidError = {description: 'Invalid request.', content: {'application/json': {schema: ApiErrorBody}}};
const notFoundError = {
  description: 'Set, card, or vocabulary entry not found.',
  content: {'application/json': {schema: ApiErrorBody}},
};
const internalError = {description: 'Unexpected server error.', content: {'application/json': {schema: ApiErrorBody}}};
const security = [{bearerAuth: []}];

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/flashcards/sets',
  summary: 'Create a flashcard set',
  tags: ['Flashcard'],
  security,
  request: {body: requestBody(CreateFlashcardSetSchema, 'createSet', {title: 'Environment vocabulary'})},
  responses: {
    201: {description: 'Set created.', content: {'application/json': {schema: CreateFlashcardSetResponseSchema}}},
    400: invalidError,
    401: authError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/flashcards/sets',
  summary: 'List the current user flashcard sets',
  tags: ['Flashcard'],
  security,
  responses: {
    200: {
      description: 'Current user sets with card counts.',
      content: {'application/json': {schema: ListFlashcardSetsResponseSchema}},
    },
    401: authError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/flashcards/sets/{id}',
  summary: 'Get a flashcard set and its cards',
  tags: ['Flashcard'],
  security,
  request: {params: FlashcardSetIdParamsSchema},
  responses: {
    200: {description: 'Set details.', content: {'application/json': {schema: GetFlashcardSetResponseSchema}}},
    400: invalidError,
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/flashcards/sets/{id}',
  summary: 'Update flashcard set details',
  tags: ['Flashcard'],
  security,
  request: {
    params: FlashcardSetIdParamsSchema,
    body: requestBody(UpdateFlashcardSetSchema, 'updateSet', {title: 'Updated title'}),
  },
  responses: {
    200: {description: 'Set updated.', content: {'application/json': {schema: GetFlashcardSetResponseSchema}}},
    400: invalidError,
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/flashcards/sets/{id}',
  summary: 'Delete a flashcard set',
  tags: ['Flashcard'],
  security,
  request: {params: FlashcardSetIdParamsSchema},
  responses: {
    200: {
      description: 'Set deleted.',
      content: {
        'application/json': {schema: DeleteFlashcardSetResponseSchema, examples: {success: {value: {deleted: true}}}},
      },
    },
    400: invalidError,
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'put',
  path: '/api/v1/flashcards/sets/{id}/cards',
  summary: 'Replace the cards in a flashcard set',
  description: 'Cards with an existing ID are updated in place so their review progress remains attached.',
  tags: ['Flashcard'],
  security,
  request: {
    params: FlashcardSetIdParamsSchema,
    body: requestBody(ReplaceFlashcardCardsRequestSchema, 'replaceCards', {
      cards: [{id: exampleSet.cards[0].id, term: 'mitigate', definition: 'giảm nhẹ'}],
    }),
  },
  responses: {
    200: {
      description: 'Cards replaced in the requested order.',
      content: {'application/json': {schema: ReplaceFlashcardCardsResponseSchema}},
    },
    400: invalidError,
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/flashcards/sets/from-vocab',
  summary: 'Create a flashcard set from vocabulary entries',
  tags: ['Flashcard'],
  security,
  request: {
    body: requestBody(CreateFlashcardSetFromVocabSchema, 'createSetFromVocab', {
      title: 'Environment vocabulary',
      vocabIds: ['0192f7e0-0bcd-7000-8000-000000000003'],
    }),
  },
  responses: {
    201: {
      description: 'Set created from vocabulary.',
      content: {'application/json': {schema: CreateFlashcardSetResponseSchema}},
    },
    400: invalidError,
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});
