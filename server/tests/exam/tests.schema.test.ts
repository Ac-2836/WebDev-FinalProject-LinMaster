import {describe, expect, it} from 'vitest';
import {CandidateGroupSchema, TestVisibilitySchema, UpdateTestRequestSchema} from '@linmaster/shared';
import {Visibility} from '../../src/generated/prisma/enums';

describe('test schemas', () => {
  it('keeps the visibility values of the database', () => {
    expect([...TestVisibilitySchema.options].sort()).toEqual(Object.values(Visibility).sort());
  });

  it('accepts a title, a source or both, trimmed', () => {
    expect(UpdateTestRequestSchema.parse({title: '  Cambridge 18 Test 1 '})).toEqual({title: 'Cambridge 18 Test 1'});
    expect(UpdateTestRequestSchema.safeParse({source: null}).success).toBe(true);
    expect(UpdateTestRequestSchema.safeParse({title: 'A', source: 'Cambridge'}).success).toBe(true);
  });

  it('rejects an empty body, an empty or long title and other fields', () => {
    for (const body of [
      {},
      {title: '   '},
      {title: 'x'.repeat(201)},
      {source: 'x'.repeat(301)},
      {title: 'A', visibility: 'public'},
      {title: 'A', attemptCount: 0},
    ]) {
      expect(UpdateTestRequestSchema.safeParse(body).success).toBe(false);
    }
  });

  it('drops answer fields a candidate group or question must not carry', () => {
    const group = CandidateGroupSchema.parse({
      id: '0192f7e0-0bcd-7000-8000-000000000001',
      kind: 'completion',
      fromNo: 1,
      toNo: 1,
      instructions: 'ONE WORD ONLY',
      wordLimit: 1,
      shared: null,
      answer: {accepted: ['library']},
      questions: [
        {id: '0192f7e0-0bcd-7000-8000-000000000002', number: 1, prompt: '{{blank}}', options: null, answer: 'x'},
      ],
    });
    expect(JSON.stringify(group)).not.toContain('library');
    expect(group.questions[0]).not.toHaveProperty('answer');
  });
});
