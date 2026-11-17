import {
  ApiErrorBody,
  CreateFlashcardSetFromVocabSchema,
  CreateFlashcardSetResponseSchema,
  CreateFlashcardSetSchema,
  DeleteFlashcardSetResponseSchema,
  FlashcardSetIdParamsSchema,
  GenerateExerciseRequestSchema,
  GenerateExerciseResponseSchema,
  GetFlashcardSetResponseSchema,
  ListFlashcardSetsResponseSchema,
  QuizQuerySchema,
  QuizResponseSchema,
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

const {id, title, description, termLang, definitionLang, createdAt, updatedAt} = exampleSet;
const setFields = {id, title, description, termLang, definitionLang, createdAt, updatedAt};
const emptySet = {...setFields, description: null, cards: []};
const setSummary = {...setFields, cardCount: exampleSet.cards.length};
const VOCAB_ID = '0192f7e0-0bcd-7000-8000-000000000003';
const setFromVocab = {
  ...exampleSet,
  description: null,
  cards: [{...exampleSet.cards[0], example: 'The new policy mitigated the impact.', vocabEntryId: VOCAB_ID}],
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
  description:
    'An empty set; add cards with `PUT /flashcards/sets/{id}/cards`. `termLang` and `definitionLang` default to ' +
    '`en` and `vi` (they pick the voice that reads the card aloud).',
  tags: ['Flashcard'],
  security,
  request: {body: requestBody(CreateFlashcardSetSchema, 'createSet', {title: 'Environment vocabulary'})},
  responses: {
    201: {
      description: 'Set created.',
      content: {
        'application/json': {schema: CreateFlashcardSetResponseSchema, examples: {success: {value: {set: emptySet}}}},
      },
    },
    400: invalidError,
    401: authError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/flashcards/sets',
  summary: 'List the current user flashcard sets',
  description: 'Sets of the current user, last edited first, with the number of cards but not the cards themselves.',
  tags: ['Flashcard'],
  security,
  responses: {
    200: {
      description: 'Current user sets with card counts.',
      content: {
        'application/json': {
          schema: ListFlashcardSetsResponseSchema,
          examples: {success: {value: {sets: [setSummary]}}},
        },
      },
    },
    401: authError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/flashcards/sets/{id}',
  summary: 'Get a flashcard set and its cards',
  description: 'One set of the current user with all its cards in study order (`position`).',
  tags: ['Flashcard'],
  security,
  request: {params: FlashcardSetIdParamsSchema},
  responses: {
    200: {
      description: 'Set details.',
      content: {
        'application/json': {schema: GetFlashcardSetResponseSchema, examples: {success: {value: {set: exampleSet}}}},
      },
    },
    400: invalidError,
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});

const CARD_B = '0192f7e0-0bcd-7000-8000-000000000023';
const CARD_C = '0192f7e0-0bcd-7000-8000-000000000024';
const quizExample = {
  setId: exampleSet.id,
  questions: [
    {
      kind: 'multiple-choice',
      cardId: exampleSet.cards[0]!.id,
      prompt: 'mitigate',
      options: ['giảm nhẹ', 'lỗi thời', 'tăng cường', 'từ bỏ'],
      answer: 'giảm nhẹ',
    },
    {kind: 'written', cardId: CARD_B, prompt: 'lỗi thời', answer: 'obsolete'},
    {kind: 'true-false', cardId: CARD_B, prompt: 'obsolete', statement: 'giảm nhẹ', answer: false},
  ],
};

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/flashcards/sets/{id}/quiz',
  summary: 'Generate a quiz from a flashcard set',
  description:
    'Builds the Test mode questions from the cards of the set: one question per card, picked at random (`count`, ' +
    'default 20, at most the number of cards). `kinds` is a comma-separated subset of `multiple-choice`, `written` ' +
    'and `true-false` (default all); kinds are used in turn. Answers come with the questions, so the client grades. ' +
    'Readable by the owner, or by anyone for a public set. Nothing is stored; every call draws a new quiz.',
  tags: ['Flashcard'],
  security,
  request: {params: FlashcardSetIdParamsSchema, query: QuizQuerySchema},
  responses: {
    200: {
      description: 'The questions.',
      content: {'application/json': {schema: QuizResponseSchema, examples: {success: {value: quizExample}}}},
    },
    400: invalidError,
    401: authError,
    404: {
      description: 'Set not found, or private or hidden and owned by someone else.',
      content: {'application/json': {schema: ApiErrorBody}},
    },
    422: {description: 'The set has fewer than 4 cards.', content: {'application/json': {schema: ApiErrorBody}}},
    500: internalError,
  },
});

const exerciseExample = {
  setId: exampleSet.id,
  questions: [
    {
      kind: 'single_choice',
      cardId: exampleSet.cards[0]!.id,
      prompt: 'Planting trees can {{blank}} the effects of climate change.',
      options: ['mitigate', 'obsolete', 'ambiguous', 'reluctant'],
      answer: 'mitigate',
    },
    {
      kind: 'completion',
      cardId: exampleSet.cards[0]!.id,
      prompt: 'The council wants to {{blank}} the damage caused by the flood.',
      answer: 'mitigate',
    },
    {
      kind: 'matching',
      items: [
        {cardId: exampleSet.cards[0]!.id, prompt: 'New measures will {{blank}} the risk.', answer: 'mitigate'},
        {cardId: CARD_B, prompt: 'The old software is now {{blank}}.', answer: 'obsolete'},
        {cardId: CARD_C, prompt: 'She was {{blank}} to admit her mistake.', answer: 'reluctant'},
      ],
      options: ['reluctant', 'mitigate', 'obsolete', 'ambiguous'],
    },
  ],
};

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/flashcards/sets/{id}/exercises',
  summary: 'Generate AI practice from a flashcard set',
  description:
    'Runs the AI task `generate-exercise.v1`: exam-style questions (`single_choice`, `completion`, `matching`, as ' +
    'asked in `kinds`) that use only the terms of the set; `count` is 10 or 20. Every sentence has one `{{blank}}`; ' +
    'every answer and option is a term of the set as written in it (the first 100 cards are used). The server drops ' +
    'questions that fail these checks, so fewer than `count` may come back; fewer than half is a 502. Answers come ' +
    'with the questions, so the client grades. Only for your own set with at least 4 cards. Nothing is stored; the ' +
    'result is cached for an hour per set and request (a cached call does not use the daily AI quota).',
  tags: ['Flashcard'],
  security,
  request: {
    params: FlashcardSetIdParamsSchema,
    body: requestBody(GenerateExerciseRequestSchema, 'exercise', {kinds: ['single_choice', 'completion'], count: 10}),
  },
  responses: {
    200: {
      description: 'The questions.',
      content: {
        'application/json': {schema: GenerateExerciseResponseSchema, examples: {success: {value: exerciseExample}}},
      },
    },
    400: invalidError,
    401: authError,
    404: {description: 'Set not found or not yours.', content: {'application/json': {schema: ApiErrorBody}}},
    422: {description: 'The set has fewer than 4 cards.', content: {'application/json': {schema: ApiErrorBody}}},
    429: {
      description: '`AI_QUOTA_EXCEEDED` (daily quota) or too many AI requests in a minute.',
      content: {'application/json': {schema: ApiErrorBody}},
    },
    502: {
      description:
        '`AI_INVALID_OUTPUT`: the model gave no valid result, or under half of the questions passed the checks.',
      content: {'application/json': {schema: ApiErrorBody}},
    },
    503: {
      description: '`AI_UNAVAILABLE`: the model could not be reached.',
      content: {'application/json': {schema: ApiErrorBody}},
    },
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/flashcards/sets/{id}',
  summary: 'Update flashcard set details',
  description: 'Changes the title, description or languages of a set; send at least one. Cards are not touched.',
  tags: ['Flashcard'],
  security,
  request: {
    params: FlashcardSetIdParamsSchema,
    body: requestBody(UpdateFlashcardSetSchema, 'updateSet', {title: 'Updated title'}),
  },
  responses: {
    200: {
      description: 'Set updated.',
      content: {
        'application/json': {
          schema: GetFlashcardSetResponseSchema,
          examples: {success: {value: {set: {...exampleSet, title: 'Updated title'}}}},
        },
      },
    },
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
  description:
    'Deletes the set with its cards, study progress and sessions. Words of the word bank stay. Copies other ' +
    'learners made from the library are theirs and stay too.',
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
      content: {
        'application/json': {
          schema: ReplaceFlashcardCardsResponseSchema,
          examples: {success: {value: {cards: exampleSet.cards}}},
        },
      },
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
  description:
    'One card per word of the word bank (1 to 100): term = headword, definition = Vietnamese meaning, example = ' +
    'the first saved sentence. Each card keeps `vocabEntryId`. 404 when a word is missing or not yours.',
  tags: ['Flashcard'],
  security,
  request: {
    body: requestBody(CreateFlashcardSetFromVocabSchema, 'createSetFromVocab', {
      title: 'Environment vocabulary',
      vocabIds: [VOCAB_ID],
    }),
  },
  responses: {
    201: {
      description: 'Set created from vocabulary.',
      content: {
        'application/json': {
          schema: CreateFlashcardSetResponseSchema,
          examples: {success: {value: {set: setFromVocab}}},
        },
      },
    },
    400: invalidError,
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});
