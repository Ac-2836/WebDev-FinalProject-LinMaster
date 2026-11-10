import {
  ApiErrorBody,
  DeleteVocabEntryResponseSchema,
  ListVocabEntriesQuerySchema,
  ListVocabEntriesResponseSchema,
  SaveVocabEntriesRequestSchema,
  SaveVocabEntriesResponseSchema,
  UpdateVocabEntryRequestSchema,
  VocabEntryIdParamsSchema,
  VocabEntryResponseSchema,
} from '@linmaster/shared';
import type {ZodType} from 'zod';
import {openApiRegistry} from '../../core/openapi-registry';

const entryExample = {
  id: '0192f7e0-0bcd-7000-8000-000000000001',
  headword: 'mitigated',
  lemma: 'mitigate',
  partOfSpeech: 'verb',
  ipa: '/ˈmɪtɪɡeɪt/',
  meaningVi: 'giảm nhẹ',
  definitionEn: 'to make something less severe',
  usageNote: null,
  collocations: ['mitigate the impact'],
  cefr: 'B2',
  topics: ['environment'],
  note: null,
  contexts: [
    {
      id: '0192f7e0-0bcd-7000-8000-000000000002',
      documentId: null,
      sentence: 'The new policy mitigated the impact.',
      startOffset: null,
      endOffset: null,
      sourceUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function jsonBody(schema: ZodType, exampleName: string, example: unknown) {
  return {content: {'application/json': {schema, examples: {[exampleName]: {summary: 'Example', value: example}}}}};
}

const authError = {description: 'Authentication required.', content: {'application/json': {schema: ApiErrorBody}}};
const invalidError = {description: 'Invalid request.', content: {'application/json': {schema: ApiErrorBody}}};
const notFoundError = {
  description: 'Entry or referenced document not found.',
  content: {'application/json': {schema: ApiErrorBody}},
};
const internalError = {description: 'Unexpected server error.', content: {'application/json': {schema: ApiErrorBody}}};

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/vocab/entries',
  summary: 'Save one or more vocabulary entries',
  description:
    'Entries with the same lemma and part of speech are merged for the current user; distinct contexts are retained.',
  tags: ['Vocab'],
  security: [{bearerAuth: []}],
  request: {
    body: jsonBody(SaveVocabEntriesRequestSchema, 'saveEntries', {
      entries: [
        {
          headword: 'mitigated',
          lemma: 'mitigate',
          partOfSpeech: 'verb',
          ipa: '/ˈmɪtɪɡeɪt/',
          meaningVi: 'giảm nhẹ',
          definitionEn: 'to make something less severe',
          collocations: ['mitigate the impact'],
          cefr: 'B2',
          topics: ['environment'],
          context: {sentence: 'The new policy mitigated the impact.'},
        },
      ],
    }),
  },
  responses: {
    201: {
      description: 'Entries saved or merged.',
      content: {
        'application/json': {
          schema: SaveVocabEntriesResponseSchema,
          examples: {success: {value: {entries: [entryExample]}}},
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
  method: 'get',
  path: '/api/v1/vocab/entries',
  summary: 'List and filter vocabulary entries',
  tags: ['Vocab'],
  security: [{bearerAuth: []}],
  request: {query: ListVocabEntriesQuerySchema},
  responses: {
    200: {
      description: 'Current user entries with pagination.',
      content: {
        'application/json': {
          schema: ListVocabEntriesResponseSchema,
          examples: {
            success: {value: {entries: [entryExample], pagination: {page: 1, pageSize: 20, total: 1, totalPages: 1}}},
          },
        },
      },
    },
    400: invalidError,
    401: authError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/vocab/entries/{id}',
  summary: 'Get a vocabulary entry',
  tags: ['Vocab'],
  security: [{bearerAuth: []}],
  request: {params: VocabEntryIdParamsSchema},
  responses: {
    200: {description: 'Entry details.', content: {'application/json': {schema: VocabEntryResponseSchema}}},
    400: invalidError,
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/vocab/entries/{id}',
  summary: 'Update a vocabulary entry note',
  tags: ['Vocab'],
  security: [{bearerAuth: []}],
  request: {
    params: VocabEntryIdParamsSchema,
    body: jsonBody(UpdateVocabEntryRequestSchema, 'updateNote', {note: 'Remember this in the next review.'}),
  },
  responses: {
    200: {description: 'Entry note updated.', content: {'application/json': {schema: VocabEntryResponseSchema}}},
    400: invalidError,
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/vocab/entries/{id}',
  summary: 'Delete a vocabulary entry',
  tags: ['Vocab'],
  security: [{bearerAuth: []}],
  request: {params: VocabEntryIdParamsSchema},
  responses: {
    200: {
      description: 'Entry deleted.',
      content: {
        'application/json': {schema: DeleteVocabEntryResponseSchema, examples: {success: {value: {deleted: true}}}},
      },
    },
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});
