import {STATUS_BY_CODE} from './app-error';

/* eslint-disable @typescript-eslint/no-explicit-any -- walks the generated OpenAPI JSON, which has no useful type. */

/** Messages the server really sends for the generic cases (error and validate middleware, requireAuth). */
const MESSAGE_BY_CODE: Record<number, string> = {
  400: 'Dữ liệu đầu vào không hợp lệ.',
  401: 'Authentication required.',
  500: 'Lỗi máy chủ nội bộ.',
};

/** `details` of the domain statuses that send some (the AI gateway's quota error). */
const DOMAIN_DETAILS: Record<string, unknown> = {AI_QUOTA_EXCEEDED: {retryAt: '2026-11-17T17:00:00.000Z'}};
/** Messages the AI gateway really sends, the same on every AI route. */
const DOMAIN_MESSAGES: Record<string, string> = {
  AI_QUOTA_EXCEEDED: 'Bạn đã dùng hết lượt AI hôm nay.',
  AI_INVALID_OUTPUT: 'AI trả về kết quả không hợp lệ, hãy thử lại.',
  AI_UNAVAILABLE: 'Dịch vụ AI tạm thời không phản hồi, hãy thử lại sau.',
  AI_REQUEST_REJECTED: 'Yêu cầu gửi tới AI bị từ chối do lỗi hệ thống, hãy báo cho nhóm phát triển.',
};

// A domain status written in backticks in a response description, e.g. "`ATTEMPT_EXPIRED`: the deadline passed."
const DOMAIN_STATUS = /`([A-Z][A-Z_]+)`(?::\s*([^`]*))?/g;

const errorBody = (code: number, status: string, message: string, details?: unknown) => ({
  error: {code, status, message, ...(details === undefined ? {} : {details})},
});

const sentence = (text: string) => {
  const trimmed = text.trim().replace(/[.;,]?\s*(or|and)?\s*$/u, '');
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.` : '';
};

/** The first input a request validates, to show what `details` of a 400 looks like. */
function firstField(operation: any): string {
  const body = operation.requestBody?.content?.['application/json']?.schema;
  const required = body?.required?.[0] ?? Object.keys(body?.properties ?? {})[0];
  if (required) return `body.${required}`;
  const param = operation.parameters?.find((p: any) => p.in === 'path') ?? operation.parameters?.[0];
  return param ? `${param.in === 'path' ? 'params' : param.in}.${param.name}` : 'body';
}

/**
 * The examples of one error response: one per domain status named in its description, plus the generic status of
 * the HTTP code when the description also covers a generic case (it does not start with a domain status).
 */
export function errorExamples(code: number, description: string, operation: any): Record<string, {value: unknown}> {
  const examples: Record<string, {value: unknown}> = {};
  const generic = STATUS_BY_CODE[code] ?? (code >= 500 ? 'INTERNAL' : 'FAILED_PRECONDITION');
  const domain = [...description.matchAll(DOMAIN_STATUS)].filter(([, status]) => status !== generic || code !== 400);

  if (!description.trimStart().startsWith('`') || domain.length === 0) {
    const before = description.split('`')[0];
    const message = MESSAGE_BY_CODE[code] ?? (sentence(before) || description);
    const details = code === 400 ? [{field: firstField(operation), message: 'Invalid input'}] : undefined;
    examples[generic] = {value: errorBody(code, generic, message, details)};
  }
  for (const [, status, text = ''] of domain) {
    const message = DOMAIN_MESSAGES[status] ?? (sentence(text) || status);
    examples[status] = {value: errorBody(code, status, message, DOMAIN_DETAILS[status])};
  }
  return examples;
}

/**
 * Gives every error response that has no example one built from its description, in the real error body shape
 * `{error: {code, status, message, details?}}`, so `/docs` shows each status a route can answer (P5-04).
 */
export function addErrorExamples<T>(document: T): T {
  for (const item of Object.values<any>((document as any).paths ?? {})) {
    for (const operation of Object.values<any>(item)) {
      for (const [code, response] of Object.entries<any>(operation.responses ?? {})) {
        const content = response.content?.['application/json'];
        if (!/^[45]/.test(code) || !content || content.example || content.examples) continue;
        content.examples = errorExamples(Number(code), response.description ?? '', operation);
      }
    }
  }
  return document;
}
