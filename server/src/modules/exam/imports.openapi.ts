import {
  ApiErrorBody,
  DeleteImportFileResponseSchema,
  ImportFileIdParamsSchema,
  UploadImportFileResponseSchema,
} from '@linmaster/shared';
import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi';
import {z} from 'zod';

import {openApiRegistry} from '../../core/openapi-registry';

extendZodWithOpenApi(z);

const FILE_ID = '0192f7e0-0bcd-7000-8000-000000000031';
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
    500: error('Unexpected server error.'),
  },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/tests/imports/files/{fileId}',
  summary: 'Remove an uploaded file that no import uses',
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
