import {OpenAPIRegistry, OpenApiGeneratorV31} from '@asteasolutions/zod-to-openapi';

import {AI_DAILY_QUOTA} from './ai/ai-gateway';
import {addErrorExamples} from './openapi-examples';
import {AI_CALLS_PER_MINUTE, UPLOADS_PER_HOUR} from './user-rate-limit';

export const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

/** The intro of `/docs`: what a reader needs before the first call, without opening the code (P5-04). */
const DESCRIPTION = `
API of LinMaster: reading and word bank, flashcards (SM-2), IELTS tests and the shared library.
Every route lives under \`/api/v1\` and speaks JSON, except the file uploads (\`multipart/form-data\`) and the
Listening audio (\`audio/mpeg\` byte ranges).

## Sign-in
\`POST /api/v1/auth/register\` or \`POST /api/v1/auth/login\` returns \`token\`, a JWT valid for 1 hour. Send it as
\`Authorization: Bearer <token>\` (the **Authorize** button above). Without it a protected route answers
\`401 UNAUTHENTICATED\`. Content of another user answers \`404 NOT_FOUND\` (or \`403 PERMISSION_DENIED\` where noted),
so nobody learns what others own.

## Errors
Every error has the same body; the client switches on \`error.status\`:

\`\`\`json
{"error": {"code": 404, "status": "NOT_FOUND", "message": "Resource not found.", "details": null}}
\`\`\`

| HTTP | \`status\` | When |
|---|---|---|
| 400 | \`INVALID_ARGUMENT\` | The body, query or path failed validation; \`details\` lists \`{field, message}\` |
| 401 | \`UNAUTHENTICATED\` | No token, or it expired |
| 403 | \`PERMISSION_DENIED\` | Not allowed, e.g. a wrong current password (\`WRONG_PASSWORD\`) |
| 404 | \`NOT_FOUND\` | It does not exist or belongs to another user |
| 409 | \`ALREADY_EXISTS\`, \`FAILED_PRECONDITION\` | Taken already, or the state does not allow it now |
| 413 / 415 | \`INVALID_ARGUMENT\` | File too large / type not accepted |
| 422 | \`FAILED_PRECONDITION\` | The file was read but has no usable content |
| 429 | \`RESOURCE_EXHAUSTED\`, \`AI_QUOTA_EXCEEDED\` | A rate limit or the daily AI quota (\`details.retryAt\`) |
| 500 | \`INTERNAL\`, \`AI_REQUEST_REJECTED\` | A bug on our side; the AI refused our request (schema, prompt or key), trying again will not help |
| 502 / 503 | \`AI_INVALID_OUTPUT\` / \`AI_UNAVAILABLE\` | The AI answered badly / could not be reached |

Routes add their own \`status\` for domain cases (e.g. \`ATTEMPT_EXPIRED\`, \`TEST_HAS_ATTEMPTS\`); each one is
listed, with an example, under the route's responses.

## Limits
- 120 requests per minute per IP on \`/api/v1\`.
- Login and password checks: 10 per 15 minutes; registration: 5 per hour (per IP).
- File uploads: ${UPLOADS_PER_HOUR} per hour per user. AI routes: ${AI_CALLS_PER_MINUTE} per minute per user.
- AI quota: ${AI_DAILY_QUOTA} AI calls per user per day (Vietnam time). Answers served from the AI cache are free.
`.trim();

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);

  const document = generator.generateDocument({
    openapi: '3.1.0',
    info: {title: 'LinMaster API', version: '1.0.0', description: DESCRIPTION},
    servers: [{url: '/'}],
    tags: [
      {name: 'Core', description: 'Health and core infrastructure.'},
      {name: 'Auth', description: 'Account registration, login, and profile management.'},
      {name: 'Vocab', description: 'Personal vocabulary entries, AI word lookup and reading contexts.'},
      {name: 'Documents', description: 'Reading document upload, extraction, and personal document management.'},
      {name: 'Flashcard', description: 'Personal flashcard sets, cards and SM-2 study sessions.'},
      {name: 'Exam', description: 'IELTS test imports, tests, attempts and results.'},
      {name: 'Library', description: 'Published sets and tests of all users: browse, preview, copy and report.'},
      {name: 'Stats', description: 'Dashboard numbers of the current user and the community.'},
    ],
  });
  return addErrorExamples(document);
}
