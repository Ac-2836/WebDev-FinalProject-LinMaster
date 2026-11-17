import {
  ApiErrorBody,
  CreateReportRequestSchema,
  CreateReportResponseSchema,
  LibraryCopyResponseSchema,
  LibraryIdParamsSchema,
  LibraryListResponseSchema,
  LibraryQuerySchema,
  LibrarySetPreviewResponseSchema,
  LibraryTestPreviewResponseSchema,
  LibraryVisibilityResponseSchema,
} from '@linmaster/shared';
import type {ZodType} from 'zod';

import {openApiRegistry} from '../../core/openapi-registry';

const ID = '0192f7e0-0bcd-7000-8000-000000000071';
const author = {id: '0192f7e0-0bcd-7000-8000-000000000070', displayName: 'Lan'};
const SET = {
  type: 'set',
  id: ID,
  title: 'IELTS Environment',
  description: 'Words from Cambridge 18',
  termLang: 'en',
  definitionLang: 'vi',
  cardCount: 1,
  copyCount: 4,
  author,
  publishedAt: '2026-11-14T03:00:00.000Z',
};
const TEST = {
  type: 'test',
  id: ID,
  title: 'Cambridge 18 Reading Test 1',
  certification: 'IELTS_ACADEMIC',
  kind: 'reading',
  skills: ['reading'],
  questionCount: 40,
  durationSec: 3600,
  attemptCount: 12,
  author,
  publishedAt: '2026-11-14T03:00:00.000Z',
};
const CARD = {id: ID, position: 0, term: 'mitigate', definition: 'giảm nhẹ', example: 'Trees mitigate heat.'};

const json = (schema: ZodType, value: unknown) => ({
  content: {'application/json': {schema, examples: {example: {value}}}},
});
const error = (description: string) => ({description, content: {'application/json': {schema: ApiErrorBody}}});
const security = [{bearerAuth: []}];
const common = {401: error('Authentication required.'), 500: error('Unexpected server error.')};
const params = {params: LibraryIdParamsSchema};

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/library',
  summary: 'Browse the library',
  description:
    'Public sets or tests only; private and hidden content never appears. `q` matches the title and the description ' +
    '(sets) or the source (tests). `skill` filters tests. `popular` sorts by copies (sets) or attempts (tests).',
  tags: ['Library'],
  security,
  request: {query: LibraryQuerySchema},
  responses: {
    200: {
      description: 'One page of content.',
      ...json(LibraryListResponseSchema, {items: [SET], pagination: {page: 1, pageSize: 20, total: 1, totalPages: 1}}),
    },
    400: error('Invalid query.'),
    ...common,
  },
});

for (const [path, name] of [
  ['sets', 'set'],
  ['tests', 'test'],
] as const) {
  openApiRegistry.registerPath({
    method: 'post',
    path: `/api/v1/library/${path}/{id}/publish`,
    summary: `Publish a ${name} to the library`,
    description:
      'Owner only. Publishing again keeps the first `publishedAt`. ' +
      (name === 'test' ? 'A test needs a source first. ' : 'A set needs at least one card. ') +
      'Content hidden after reports must be unpublished before it is published again.',
    tags: ['Library'],
    security,
    request: params,
    responses: {
      200: {
        description: 'Now public.',
        ...json(LibraryVisibilityResponseSchema, {visibility: 'public', publishedAt: '2026-11-14T03:00:00.000Z'}),
      },
      400: error('Invalid id.'),
      404: error(`The ${name} is missing or belongs to someone else.`),
      409: error(
        name === 'test'
          ? '`TEST_SOURCE_REQUIRED`: the test has no source. `CONTENT_HIDDEN`: hidden after reports.'
          : '`CONTENT_HIDDEN`: hidden after reports.',
      ),
      ...(name === 'set' ? {422: error('`SET_EMPTY`: the set has no cards.')} : {}),
      ...common,
    },
  });
  openApiRegistry.registerPath({
    method: 'post',
    path: `/api/v1/library/${path}/{id}/unpublish`,
    summary: `Take a ${name} out of the library`,
    description:
      'Owner only; the content becomes private. Unpublishing hidden content closes its open reports. ' +
      (name === 'set' ? 'Copies made by others are not touched.' : 'Submitted attempts keep their results.'),
    tags: ['Library'],
    security,
    request: params,
    responses: {
      200: {
        description: 'Now private.',
        ...json(LibraryVisibilityResponseSchema, {visibility: 'private', publishedAt: '2026-11-14T03:00:00.000Z'}),
      },
      400: error('Invalid id.'),
      404: error(`The ${name} is missing or belongs to someone else.`),
      ...common,
    },
  });
}

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/library/sets/{id}',
  summary: 'Preview a public set',
  description: 'All the cards. `viewer.copiedSetId` is the newest copy the viewer already made.',
  tags: ['Library'],
  security,
  request: params,
  responses: {
    200: {
      description: 'The set and its cards.',
      ...json(LibrarySetPreviewResponseSchema, {
        set: {...SET, cards: [CARD]},
        viewer: {isOwner: false, reported: false, copiedSetId: null},
      }),
    },
    400: error('Invalid id.'),
    404: error('The set is missing, private or hidden.'),
    ...common,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/library/tests/{id}',
  summary: 'Preview a public test',
  description:
    'Title, skills, number of questions, duration, question kinds, author and attempts. Never the questions or the ' +
    'answers; take the test with `POST /attempts`.',
  tags: ['Library'],
  security,
  request: params,
  responses: {
    200: {
      description: 'Summary of the test.',
      ...json(LibraryTestPreviewResponseSchema, {
        test: {...TEST, source: 'Cambridge IELTS 18', questionKinds: ['completion', 'tfng']},
        viewer: {isOwner: false, reported: false},
      }),
    },
    400: error('Invalid id.'),
    404: error('The test is missing, private or hidden.'),
    ...common,
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/library/sets/{id}/copy',
  summary: 'Copy a public set into my library',
  description:
    'Deep copy into a new private set with `copiedFromId`; the original gets `copyCount + 1`. Editing the copy never ' +
    'changes the original. Copying a set again while the copy still exists returns that copy with `200`: no new set, ' +
    'no `copyCount` change (so a double click or a retry is safe).',
  tags: ['Library'],
  security,
  request: params,
  responses: {
    200: {description: 'The copy the user already had.', ...json(LibraryCopyResponseSchema, {setId: ID})},
    201: {description: 'The new set.', ...json(LibraryCopyResponseSchema, {setId: ID})},
    400: error('Invalid id.'),
    404: error('The set is missing, private or hidden.'),
    409: error('`OWN_CONTENT`: the set is already yours.'),
    ...common,
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/library/reports',
  summary: 'Report public content',
  description: 'One report per person per content. The third open report hides the content from the library.',
  tags: ['Library'],
  security,
  request: {
    body: json(CreateReportRequestSchema, {targetType: 'test', targetId: ID, reason: 'copyright', detail: null}),
  },
  responses: {
    201: {description: 'Report saved.', ...json(CreateReportResponseSchema, {reported: true})},
    400: error('Invalid body.'),
    404: error('The content is missing, private or hidden.'),
    409: error('`OWN_CONTENT`: your own content. `ALREADY_REPORTED`: you reported it before.'),
    ...common,
  },
});
