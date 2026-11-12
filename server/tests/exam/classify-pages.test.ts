import {ClassifyPagesOutputSchema, type ClassifyPagesOutput} from '@linmaster/shared';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {setAiModel} from '../../src/core/ai/ai-gateway';
import {createMockAiModel} from '../../src/core/ai/ai-model';
import {getDb} from '../../src/core/db';
import {alignPageLabels, classifyPages} from '../../src/modules/exam/ai';

/** Minimal valid PDF with `pageCount` empty pages; `tag` makes the bytes (and the AI cache key) unique. */
function createPdf(pageCount: number, tag: string): Buffer {
  const pageIds = Array.from({length: pageCount}, (_, i) => i + 3);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    ...pageIds.map(() => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>'),
  ];
  let pdf = `%PDF-1.4\n% ${tag}\n`;
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

const page = (n: number, overrides: Partial<ClassifyPagesOutput['pages'][number]> = {}) => ({
  page: n,
  labels: ['questions' as const],
  skill: 'reading' as const,
  questionRange: {from: 1, to: 13},
  ...overrides,
});

describe('alignPageLabels', () => {
  it('gives exactly one entry per real page, filling skipped pages with other', () => {
    const aligned = alignPageLabels({pages: [page(3), page(1), page(1, {labels: ['answers']}), page(7)]}, 3);
    expect(aligned.map(p => p.page)).toEqual([1, 2, 3]);
    expect(aligned[0].labels).toEqual(['questions']); // the first entry of a repeated page wins
    expect(aligned[1]).toEqual({page: 2, labels: ['other'], skill: null, questionRange: null});
  });

  it('removes repeated labels and orders a reversed question range', () => {
    const [aligned] = alignPageLabels(
      {pages: [page(1, {labels: ['passage', 'questions', 'passage'], questionRange: {from: 13, to: 1}})]},
      1,
    );
    expect(aligned.labels).toEqual(['passage', 'questions']);
    expect(aligned.questionRange).toEqual({from: 1, to: 13});
  });
});

// Real test database (AiUsage, AiCache); only the model is the mock, Gemini is never called.
describe('classifyPages', () => {
  const db = getDb();
  const email = `classify-${Date.now()}@linmaster.test`;
  let userId: string;

  beforeAll(async () => {
    userId = (await db.user.create({data: {email, passwordHash: 'x', displayName: 'Classify'}})).id;
  });
  afterAll(async () => {
    await db.aiCache.deleteMany({where: {task: 'classify-pages.v1', model: 'mock-model'}});
    await db.user.deleteMany({where: {email}});
    await db.$disconnect();
  });

  it('labels a PDF with an answer key at the end and caches by file content', async () => {
    const reply = ClassifyPagesOutputSchema.parse({
      pages: [
        page(1, {labels: ['passage'], questionRange: null}),
        page(2),
        page(3, {labels: ['answers'], questionRange: {from: 1, to: 40}}),
      ],
    });
    const model = createMockAiModel([reply]);
    setAiModel(model);
    const pdf = createPdf(3, `answers-at-end-${Date.now()}`);

    const first = await classifyPages(pdf, {userId});
    const second = await classifyPages(Buffer.from(pdf), {userId});

    expect(first.map(p => p.labels)).toEqual([['passage'], ['questions'], ['answers']]);
    expect(second).toEqual(first);
    expect(model.requests).toHaveLength(1); // same bytes: served from AiCache
    expect(model.requests[0].pdf?.equals(pdf)).toBe(true);
  });

  it('rejects a file that is not a readable PDF before calling the AI', async () => {
    const model = createMockAiModel([]);
    setAiModel(model);
    await expect(classifyPages(Buffer.from('not a pdf'), {userId})).rejects.toMatchObject({statusCode: 400});
    expect(model.requests).toHaveLength(0);
  });
});
