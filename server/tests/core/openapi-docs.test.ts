import {readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';

import {LibraryErrorStatusSchema} from '@linmaster/shared';
import type {ZodType} from 'zod';
import {describe, expect, it} from 'vitest';

import {errorExamples} from '../../src/core/openapi-examples';
import {generateOpenApiDocument, openApiRegistry} from '../../src/core/openapi-registry';
import {createApiModules} from '../../src/modules';

/* eslint-disable @typescript-eslint/no-explicit-any -- reads the generated OpenAPI JSON. */

// P5-04: `/docs` must be readable without the code: every route explained, with examples that match the real
// schemas and every error status the code can send.
createApiModules('test-secret-that-is-at-least-thirty-two-characters');
const document = generateOpenApiDocument() as any;
const operations = Object.entries<any>(document.paths).flatMap(([route, item]) =>
  Object.entries<any>(item).map(([method, operation]) => ({name: `${method.toUpperCase()} ${route}`, operation})),
);

/** Each example written next to a Zod schema in the registry, with the schema it must parse with. */
function registeredExamples() {
  const found: {where: string; schema: ZodType; value: unknown}[] = [];
  const collect = (where: string, content: any) => {
    for (const [type, media] of Object.entries<any>(content ?? {})) {
      if (!media?.schema?.safeParse) continue;
      const values = [
        ...(media.example === undefined ? [] : [media.example]),
        ...Object.values<any>(media.examples ?? {}).map(example => example.value),
      ];
      for (const value of values) found.push({where: `${where} ${type}`, schema: media.schema, value});
    }
  };
  for (const definition of openApiRegistry.definitions as any[]) {
    if (definition.type !== 'route') continue;
    const {method, path: route, request, responses} = definition.route;
    const name = `${method.toUpperCase()} ${route}`;
    collect(`${name} request`, request?.body?.content);
    for (const [code, response] of Object.entries<any>(responses ?? {})) collect(`${name} ${code}`, response.content);
  }
  return found;
}

/** Domain statuses passed to `new AppError(...)` anywhere in the server code. */
function thrownStatuses(dir = path.join(__dirname, '../../src')): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return thrownStatuses(full);
    if (!name.endsWith('.ts')) return [];
    const calls = readFileSync(full, 'utf8').match(/new AppError\([^;]*?'([A-Z][A-Z_]+)'\s*,?\s*\)/g) ?? [];
    return calls.map(call => call.match(/'([A-Z][A-Z_]+)'\s*,?\s*\)$/)![1]);
  });
}

describe('API documentation (/docs)', () => {
  it('explains every route: summary, description and a declared tag', () => {
    const tags = new Set(document.tags.map((tag: any) => tag.name));
    const missing = operations.flatMap(({name, operation}) => [
      ...(operation.summary ? [] : [`${name}: summary`]),
      ...(operation.description ? [] : [`${name}: description`]),
      ...(operation.tags?.length && operation.tags.every((tag: string) => tags.has(tag)) ? [] : [`${name}: tag`]),
    ]);
    expect(missing).toEqual([]);
  });

  it('shows an example of every JSON request body and every JSON answer', () => {
    const missing = operations.flatMap(({name, operation}) => {
      const bodies = [
        ['request', operation.requestBody?.content?.['application/json']],
        ...Object.entries<any>(operation.responses).map(([code, response]) => [
          code,
          response.content?.['application/json'],
        ]),
      ];
      return bodies
        .filter(([, media]) => media && !media.example && !media.examples)
        .map(([where]) => `${name} ${where}`);
    });
    expect(missing).toEqual([]);
  });

  it('documents 400, 401 and 404 wherever a route can answer them', () => {
    const missing = operations.flatMap(({name, operation}) => {
      const codes = Object.keys(operation.responses);
      const takesInput = Boolean(operation.requestBody) || Boolean(operation.parameters?.length);
      return [
        ...(operation.security && !codes.includes('401') ? [`${name}: 401`] : []),
        ...(takesInput && !codes.includes('400') ? [`${name}: 400`] : []),
        ...(name.includes('{') && !codes.includes('404') ? [`${name}: 404`] : []),
      ];
    });
    expect(missing).toEqual([]);
  });

  it('keeps every example in step with the schema it documents', () => {
    const examples = registeredExamples();
    expect(examples.length).toBeGreaterThan(60);
    const wrong = examples
      .map(({where, schema, value}) => ({where, result: schema.safeParse(value)}))
      .filter(({result}) => !result.success)
      .map(({where, result}) => `${where}: ${result.error!.issues.map(issue => issue.path.join('.')).join(', ')}`);
    expect(wrong).toEqual([]);
  });

  it('lists, with an example, every domain status the code can send', () => {
    const documented = new Set(
      operations.flatMap(({operation}) =>
        Object.values<any>(operation.responses).flatMap(response =>
          Object.values<any>(response.content?.['application/json']?.examples ?? {}).map(
            example => example.value?.error?.status,
          ),
        ),
      ),
    );
    const statuses = [...new Set([...thrownStatuses(), ...LibraryErrorStatusSchema.options])];
    expect(statuses.length).toBeGreaterThan(10);
    expect(statuses.filter(status => !documented.has(status))).toEqual([]);
  });
});

describe('error examples', () => {
  const operation = {requestBody: {content: {'application/json': {schema: {required: ['email']}}}}};

  it('shows the validation details of a 400', () => {
    expect(errorExamples(400, 'Invalid request.', operation)).toEqual({
      INVALID_ARGUMENT: {
        value: {
          error: {
            code: 400,
            status: 'INVALID_ARGUMENT',
            message: 'Dữ liệu đầu vào không hợp lệ.',
            details: [{field: 'body.email', message: 'Invalid input'}],
          },
        },
      },
    });
  });

  it('gives one example per domain status, plus the generic one when the text starts with a general case', () => {
    const both = errorExamples(
      403,
      'The attempt belongs to another user, or `ATTEMPT_NOT_SUBMITTED`: still running.',
      {},
    );
    expect(Object.keys(both)).toEqual(['PERMISSION_DENIED', 'ATTEMPT_NOT_SUBMITTED']);
    expect(both.ATTEMPT_NOT_SUBMITTED.value).toEqual({
      error: {code: 403, status: 'ATTEMPT_NOT_SUBMITTED', message: 'Still running.'},
    });

    const onlyDomain = errorExamples(
      409,
      '`ATTEMPT_EXPIRED`: the deadline passed. `ATTEMPT_SUBMITTED`: it was sent.',
      {},
    );
    expect(Object.keys(onlyDomain)).toEqual(['ATTEMPT_EXPIRED', 'ATTEMPT_SUBMITTED']);
  });
});
