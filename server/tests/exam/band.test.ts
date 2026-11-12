import {describe, expect, it} from 'vitest';
import {
  CERTIFICATIONS,
  IELTS_ACADEMIC_READING_BANDS,
  IELTS_LISTENING_BANDS,
  SkillSchema,
  toBand,
} from '@linmaster/shared';

const ielts = CERTIFICATIONS.IELTS_ACADEMIC;

describe('band tables', () => {
  it('are the tables of the IELTS Academic certification, from band 9 down to 0', () => {
    expect(ielts.sections.listening.bandTable).toBe(IELTS_LISTENING_BANDS);
    expect(ielts.sections.reading.bandTable).toBe(IELTS_ACADEMIC_READING_BANDS);
    for (const table of [IELTS_LISTENING_BANDS, IELTS_ACADEMIC_READING_BANDS]) {
      expect(table[0]).toEqual({minCorrect: 39, band: 9});
      expect(table.at(-1)).toEqual({minCorrect: 0, band: 0});
    }
  });

  it.each([
    [40, 9],
    [39, 9],
    [38, 8.5],
    [35, 8],
    [34, 7.5],
    [32, 7.5],
    [31, 7],
    [30, 7],
    [29, 6.5],
    [26, 6.5],
    [25, 6],
    [23, 6],
    [22, 5.5],
    [18, 5.5],
    [17, 5],
    [16, 5],
    [15, 4.5],
    [13, 4.5],
    [12, 4],
    [10, 4],
    [0, 0],
  ])('Listening %i correct → band %d', (correct, band) => {
    expect(toBand(ielts, 'listening', correct)).toBe(band);
  });

  it.each([
    [40, 9],
    [37, 8.5],
    [35, 8],
    [34, 7.5],
    [33, 7.5],
    [32, 7],
    [30, 7],
    [29, 6.5],
    [27, 6.5],
    [26, 6],
    [23, 6],
    [22, 5.5],
    [19, 5.5],
    [18, 5],
    [15, 5],
    [14, 4.5],
    [13, 4.5],
    [12, 4],
    [10, 4],
    [0, 0],
  ])('Academic Reading %i correct → band %d', (correct, band) => {
    expect(toBand(ielts, 'reading', correct)).toBe(band);
  });

  it('never lowers the band when the score goes up, and only uses half bands', () => {
    for (const skill of SkillSchema.options) {
      let previous = -1;
      for (let correct = 0; correct <= 40; correct++) {
        const band = toBand(ielts, skill, correct);
        expect(band).toBeGreaterThanOrEqual(previous);
        expect(band * 2).toBe(Math.round(band * 2));
        previous = band;
      }
    }
  });

  it('rejects a score outside 0..40 or not a whole number', () => {
    for (const correct of [-1, 41, 2.5, Number.NaN]) {
      expect(() => toBand(ielts, 'reading', correct)).toThrow(RangeError);
    }
  });
});
