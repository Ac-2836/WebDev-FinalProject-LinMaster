import {
  ApiErrorBody,
  CreateImportRequestSchema,
  CreateImportResponseSchema,
  DeleteImportFileResponseSchema,
  GetImportResponseSchema,
  ImportFileIdParamsSchema,
  ImportIdParamsSchema,
  UploadImportFileResponseSchema,
} from '@linmaster/shared';
import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi';
import {z} from 'zod';

import {openApiRegistry} from '../../core/openapi-registry';

extendZodWithOpenApi(z);

const FILE_ID = '0192f7e0-0bcd-7000-8000-000000000031';
const AUDIO_FILE_ID = '0192f7e0-0bcd-7000-8000-000000000032';
const IMPORT_ID = '0192f7e0-0bcd-7000-8000-000000000051';
const QUEUED_IMPORT = {
  id: IMPORT_ID,
  kind: 'listening',
  status: 'queued',
  errors: [],
  testId: null,
  createdAt: '2026-11-13T03:05:00.000Z',
  finishedAt: null,
};
const error = (description: string) => ({description, content: {'application/json': {schema: ApiErrorBody}}});
const security = [{bearerAuth: []}];

const uploadImportFileSchema = z.object({file: z.string().openapi({type: 'string', format: 'binary'})});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/tests/imports/files',
  summary: 'Upload one file of a test',
  description:
    'One PDF (≤ 20 MB) or MP3/M4A (≤ 60 MB) per request, type checked from the content. Every PDF page is ' +
    'labelled by `classify-pages.v1` (cached by file); when the AI is unavailable `pages` is null and the ' +
    '"Theo mẫu" tab still works. Audio gets its length. Files no import uses are deleted after 24 hours.',
  tags: ['Exam'],
  security,
  request: {body: {content: {'multipart/form-data': {schema: uploadImportFileSchema}}}},
  responses: {
    201: {
      description: 'File stored.',
      content: {
        'application/json': {
          schema: UploadImportFileResponseSchema,
          examples: {
            pdf: {
              value: {
                file: {
                  id: FILE_ID,
                  originalName: 'cambridge-reading-test-1.pdf',
                  mimeType: 'application/pdf',
                  sizeBytes: 1843200,
                  type: 'pdf',
                  pageCount: 2,
                  durationSec: null,
                  pages: [
                    {page: 1, labels: ['passage', 'questions'], skill: 'reading', questionRange: {from: 1, to: 13}},
                    {page: 2, labels: ['answers'], skill: 'reading', questionRange: {from: 1, to: 40}},
                  ],
                  unused: false,
                  createdAt: '2026-11-13T03:00:00.000Z',
                },
              },
            },
          },
        },
      },
    },
    400: error('No file, more than one file, an unreadable PDF or an audio file whose length cannot be read.'),
    401: error('Authentication required.'),
    413: error('The file is too large.'),
    415: error('Only PDF, MP3 and M4A files are accepted.'),
    429: error('More than 30 uploads in an hour by this user.'),
    500: error('Unexpected server error.'),
  },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/tests/imports/files/{fileId}',
  summary: 'Remove an uploaded file that no import uses',
  description:
    'Deletes a file the user uploaded but has not sent in a test import yet (e.g. the wrong PDF was picked). ' +
    'Once an import uses it, the file stays with that import.',
  tags: ['Exam'],
  security,
  request: {params: ImportFileIdParamsSchema},
  responses: {
    200: {
      description: 'File deleted.',
      content: {'application/json': {schema: DeleteImportFileResponseSchema, examples: {ok: {value: {deleted: true}}}}},
    },
    400: error('Invalid file id.'),
    401: error('Authentication required.'),
    404: error('File not found.'),
    409: error('`IMPORT_FILE_IN_USE`: the file belongs to a test import.'),
    500: error('Unexpected server error.'),
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/tests/imports',
  summary: 'Create a test import from uploaded files',
  description:
    'Up to 10 uploaded files of the user. The "Theo mẫu" tab sends the boxes of each file (`slots`) and needs no ' +
    'AI call; the "AI nhận diện" tab sends none and its PDFs are labelled again (from the AI cache). The server ' +
    'rebuilds the "Độ đầy đủ" table and answers 422 `IMPORT_INCOMPLETE` with `{checklist}` in `error.details` ' +
    'when a required part is missing. The PDFs used are merged into one, which becomes both the question and ' +
    'the answer file; the audio becomes the audio file. A background job starts at once ' +
    '(`queued` → `parsing` → `validating` → `done` | `failed`); poll `GET /tests/imports/{id}` every few seconds.',
  tags: ['Exam'],
  security,
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateImportRequestSchema,
          examples: {
            theoMau: {
              value: {
                kind: 'listening',
                files: [
                  {fileId: FILE_ID, slots: ['test', 'answers']},
                  {fileId: AUDIO_FILE_ID, slots: ['audio']},
                ],
              },
            },
            aiNhanDien: {value: {kind: 'listening', files: [{fileId: FILE_ID}, {fileId: AUDIO_FILE_ID}]}},
          },
        },
      },
    },
  },
  responses: {
    202: {
      description: 'Import queued.',
      content: {
        'application/json': {schema: CreateImportResponseSchema, examples: {queued: {value: {import: QUEUED_IMPORT}}}},
      },
    },
    400: error(
      'Invalid body, a box that does not fit the file type (e.g. audio in the test box), more than one audio ' +
        'file or an unreadable PDF.',
    ),
    401: error('Authentication required.'),
    404: error('A file was not found among the files of the user.'),
    409: error('`IMPORT_FILE_IN_USE`: a file already belongs to a test import.'),
    413: error('The merged PDF exceeds 20 MB.'),
    422: error('`IMPORT_INCOMPLETE`: a required part is missing; `error.details.checklist` is the table.'),
    429: error(
      'More than 20 AI requests in a minute, or `AI_QUOTA_EXCEEDED`: the daily AI quota ran out while labelling a PDF.',
    ),
    502: error('`AI_INVALID_OUTPUT`: the AI answer could not be read.'),
    503: error('`AI_UNAVAILABLE`: the AI is unavailable; the "Theo mẫu" tab still works.'),
    500: error('Unexpected server error.'),
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/tests/imports/{id}',
  summary: 'Status and issues of a test import',
  description:
    'Only the owner. `errors` holds blocking errors (`failed`) and warnings (`done`). An unfinished import whose ' +
    'job stopped (the server restarted or slept) starts again on this call.',
  tags: ['Exam'],
  security,
  request: {params: ImportIdParamsSchema},
  responses: {
    200: {
      description: 'The import.',
      content: {
        'application/json': {schema: GetImportResponseSchema, examples: {queued: {value: {import: QUEUED_IMPORT}}}},
      },
    },
    400: error('Invalid import id.'),
    401: error('Authentication required.'),
    404: error('Import not found.'),
    500: error('Unexpected server error.'),
  },
});
