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
import {z} from 'zod';
import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi';
import {openApiRegistry} from '../../core/openapi-registry';
import {
  CreatePastedDocumentRequestSchema,
  CreateVocabDocumentResponseSchema,
  DeleteVocabDocumentResponseSchema,
  GetVocabDocumentResponseSchema,
  ListVocabDocumentsResponseSchema,
  VocabDocumentIdParamsSchema,
} from '@linmaster/shared';

extendZodWithOpenApi(z);

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

const documentExample = {
  id: '0192f7e0-0bcd-7000-8000-000000000010',
  title: 'Climate change article',
  source: 'paste',
  paragraphs: [{text: 'Climate change is a global challenge.'}],
  wordCount: 6,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const uploadDocumentSchema = z.object({
  title: z.string().optional(),
  file: z.string().openapi({type: 'string', format: 'binary'}),
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/vocab/documents',
  summary: 'Create a reading document',
  description:
    'Accepts pasted text as JSON or a PDF, DOCX, or TXT file as multipart form data. The original file is not stored.',
  tags: ['Documents'],
  security: [{bearerAuth: []}],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePastedDocumentRequestSchema,
          examples: {
            paste: {
              summary: 'Pasted text',
              value: {title: 'Climate change article', text: 'Climate change is a global challenge.'},
            },
          },
        },
        'multipart/form-data': {
          schema: uploadDocumentSchema,
          examples: {
            upload: {
              summary: 'Upload a PDF, DOCX, or TXT file',
              value: {title: 'Climate change article', file: 'sample.pdf'},
            },
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Document text extracted and saved.',
      content: {
        'application/json': {
          schema: CreateVocabDocumentResponseSchema,
          examples: {success: {value: {document: documentExample}}},
        },
      },
    },
    400: invalidError,
    401: authError,
    413: {
      description: 'File exceeds 5 MB or document exceeds 20,000 words.',
      content: {'application/json': {schema: ApiErrorBody}},
    },
    415: {
      description: 'Only PDF, DOCX, and TXT files are supported.',
      content: {'application/json': {schema: ApiErrorBody}},
    },
    422: {description: 'No readable text was found.', content: {'application/json': {schema: ApiErrorBody}}},
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/vocab/documents',
  summary: 'List reading documents',
  tags: ['Documents'],
  security: [{bearerAuth: []}],
  responses: {
    200: {
      description: 'Documents owned by the current user.',
      content: {'application/json': {schema: ListVocabDocumentsResponseSchema}},
    },
    401: authError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/vocab/documents/{id}',
  summary: 'Get a reading document and its saved vocabulary',
  tags: ['Documents'],
  security: [{bearerAuth: []}],
  request: {params: VocabDocumentIdParamsSchema},
  responses: {
    200: {
      description: 'Document paragraphs and vocabulary saved from it.',
      content: {'application/json': {schema: GetVocabDocumentResponseSchema}},
    },
    400: invalidError,
    401: authError,
    404: notFoundError,
    500: internalError,
  },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/vocab/documents/{id}',
  summary: 'Delete a reading document',
  description: 'Saved vocabulary sentences remain but are detached from the deleted document.',
  tags: ['Documents'],
  security: [{bearerAuth: []}],
  request: {params: VocabDocumentIdParamsSchema},
  responses: {
    200: {
      description: 'Document deleted.',
      content: {
        'application/json': {schema: DeleteVocabDocumentResponseSchema, examples: {success: {value: {deleted: true}}}},
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
