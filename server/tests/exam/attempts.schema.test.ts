import {describe, expect, it} from 'vitest';
import {
  AttemptStateSchema,
  AttemptStatusSchema,
  EMPTY_ATTEMPT_STATE,
  SaveAttemptStateRequestSchema,
} from '@linmaster/shared';
import {AttemptStatus} from '../../src/generated/prisma/enums';

const QUESTION = '0192f7e0-0bcd-7000-8000-000000000001';
const PASSAGE = '0192f7e0-0bcd-7000-8000-000000000002';
const SECTION = '0192f7e0-0bcd-7000-8000-000000000003';

const state = {
  answers: {[QUESTION]: 'library'},
  highlights: [{passageId: PASSAGE, paragraph: 0, start: 3, end: 9}],
  notes: [{passageId: PASSAGE, paragraph: 1, start: 0, end: 4, text: 'main idea'}],
  flags: [QUESTION],
  position: {sectionId: SECTION, questionId: QUESTION},
};

describe('attempt schemas', () => {
  it('keeps the attempt status values of the database', () => {
    expect([...AttemptStatusSchema.options].sort()).toEqual(Object.values(AttemptStatus).sort());
  });

  it('accepts a saved state and the empty state', () => {
    expect(AttemptStateSchema.parse(state)).toEqual(state);
    expect(AttemptStateSchema.parse(EMPTY_ATTEMPT_STATE)).toEqual(EMPTY_ATTEMPT_STATE);
    expect(SaveAttemptStateRequestSchema.safeParse({state: {...state, answers: {[QUESTION]: null}}}).success).toBe(
      true,
    );
  });

  it('rejects answers keyed by number, empty ranges, long answers and unknown fields', () => {
    for (const bad of [
      {...state, answers: {'1': 'library'}},
      {...state, answers: {[QUESTION]: 'x'.repeat(501)}},
      {...state, highlights: [{passageId: PASSAGE, paragraph: 0, start: 5, end: 5}]},
      {...state, flags: ['1']},
      {...state, score: 40},
    ]) {
      expect(AttemptStateSchema.safeParse(bad).success).toBe(false);
    }
    expect(SaveAttemptStateRequestSchema.safeParse({state, status: 'submitted'}).success).toBe(false);
  });
});
