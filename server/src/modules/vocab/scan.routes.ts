import {
  ApiErrorBody,
  type ScanDocumentRequest,
  ScanDocumentRequestSchema,
  ScanDocumentResponseSchema,
  VocabDocumentIdParamsSchema,
} from '@linmaster/shared';
import type {Router} from 'express';
import {z} from 'zod';

import {catchAsync} from '../../core/catch-async';
import {openApiRegistry} from '../../core/openapi-registry';
import {requireAuth} from '../../core/require-auth.middleware';
import {aiRateLimit} from '../../core/user-rate-limit';
import {validate} from '../../core/validate.middleware';
import {createScanService} from './scan.service';

/** Adds the AI quick filter route (KH's part) to the vocab router; added directly because route coverage rejects nested routers. */
export function addScanRoute(router: Router, jwtSecret: string, service = createScanService()): Router {
  router.post(
    '/vocab/documents/:id/scan',
    requireAuth(jwtSecret),
    aiRateLimit(),
    validate(z.object({params: VocabDocumentIdParamsSchema, body: ScanDocumentRequestSchema})),
    catchAsync(async (req, res) => {
      const {id} = req.params as {id: string};
      res.json(await service.scan(req.user!.userId, id, req.body as ScanDocumentRequest));
    }),
  );
  return router;
}

const error = (description: string) => ({description, content: {'application/json': {schema: ApiErrorBody}}});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/vocab/documents/{id}/scan',
  summary: 'Quick filter: words of a document by CEFR level and topic',
  description:
    'Runs the AI task scan-document.v1 on one of your documents. Every candidate comes with its sentence; ' +
    'candidates whose sentence is not in the document are dropped. Offsets locate the headword in the document text ' +
    '(paragraphs joined by a blank line). Nothing is saved; save chosen words with POST /api/v1/vocab/entries.',
  tags: ['Vocab'],
  security: [{bearerAuth: []}],
  request: {
    params: VocabDocumentIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: ScanDocumentRequestSchema,
          examples: {
            filter: {summary: 'B2–C1 environment words', value: {levels: ['B2', 'C1'], topics: ['environment']}},
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Candidates found in the document.',
      content: {
        'application/json': {
          schema: ScanDocumentResponseSchema,
          examples: {
            success: {
              value: {
                candidates: [
                  {
                    headword: 'mitigate',
                    lemma: 'mitigate',
                    partOfSpeech: 'verb',
                    meaningVi: 'giảm nhẹ',
                    cefr: 'C1',
                    topics: ['environment'],
                    sentence: 'Cities plant trees to mitigate the heat.',
                    startOffset: 22,
                    endOffset: 30,
                  },
                ],
              },
            },
          },
        },
      },
    },
    400: error('Invalid document id or filters.'),
    401: error('Authentication required.'),
    404: error('Document not found or not owned by the current user.'),
    429: error(
      'Daily AI quota used up (status AI_QUOTA_EXCEEDED, details.retryAt), or more than 20 AI requests in a minute.',
    ),
    502: error('The AI returned invalid output 3 times (status AI_INVALID_OUTPUT).'),
    503: error('The AI service is unavailable (status AI_UNAVAILABLE).'),
    500: error('Unexpected server error.'),
  },
});
