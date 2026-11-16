import {
  ApiErrorBody,
  type LookupWordRequest,
  LookupWordRequestSchema,
  LookupWordResponseSchema,
} from '@linmaster/shared';
import type {Router} from 'express';
import {z} from 'zod';

import {catchAsync} from '../../core/catch-async';
import {openApiRegistry} from '../../core/openapi-registry';
import {requireAuth} from '../../core/require-auth.middleware';
import {aiRateLimit} from '../../core/user-rate-limit';
import {validate} from '../../core/validate.middleware';
import {createLookupService} from './lookup.service';

/** Adds the AI lookup route (KH's part) to the vocab router; added directly because route coverage rejects nested routers. */
export function addLookupRoute(router: Router, jwtSecret: string, service = createLookupService()): Router {
  router.post(
    '/vocab/lookups',
    requireAuth(jwtSecret),
    aiRateLimit(),
    validate(z.object({body: LookupWordRequestSchema})),
    catchAsync(async (req, res) => {
      res.json(await service.lookup(req.user!.userId, req.body as LookupWordRequest));
    }),
  );
  return router;
}

const error = (description: string) => ({description, content: {'application/json': {schema: ApiErrorBody}}});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/vocab/lookups',
  summary: 'Explain a word in its sentence',
  description:
    'Runs the AI task explain-word.v1: the meaning of the selected text (at most 6 words) in this sentence. ' +
    'Does not save anything to the word bank; save with POST /api/v1/vocab/entries. ' +
    'Independent of the web reader, so a browser extension can call it with sourceUrl.',
  tags: ['Vocab'],
  security: [{bearerAuth: []}],
  request: {
    body: {
      content: {
        'application/json': {
          schema: LookupWordRequestSchema,
          examples: {
            reader: {
              summary: 'Lookup from the reader',
              value: {
                text: 'bank',
                sentence: 'We sat on the river bank.',
                documentId: '0192f7e0-0bcd-7000-8000-000000000010',
              },
            },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Explanation of the selected text in this sentence.',
      content: {
        'application/json': {
          schema: LookupWordResponseSchema,
          examples: {
            success: {
              value: {
                explanation: {
                  headword: 'bank',
                  lemma: 'bank',
                  partOfSpeech: 'noun',
                  ipa: '/bæŋk/',
                  meaningVi: 'bờ sông',
                  definitionEn: 'the land along the side of a river',
                  usageNote: 'Thường đi với river: the river bank.',
                  collocations: ['river bank', 'on the bank'],
                  cefr: 'B1',
                  topics: ['nature'],
                },
                savedEntryId: null,
              },
            },
          },
        },
      },
    },
    400: error('Invalid request, e.g. more than 6 words or the sentence does not contain the text.'),
    401: error('Authentication required.'),
    404: error('documentId is not a document of the current user.'),
    429: error(
      'More than 20 AI requests in a minute, or `AI_QUOTA_EXCEEDED`: the daily AI quota is used up (details.retryAt).',
    ),
    502: error('`AI_INVALID_OUTPUT`: the AI returned invalid output 3 times.'),
    503: error('`AI_UNAVAILABLE`: the AI service is unavailable.'),
    500: error('Unexpected server error.'),
  },
});
