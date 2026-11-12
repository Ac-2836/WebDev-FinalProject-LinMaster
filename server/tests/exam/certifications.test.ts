import {describe, expect, it} from 'vitest';
import {
  attemptDurationSec,
  CERTIFICATIONS,
  CertificationIdSchema,
  getCertification,
  QuestionKindSchema,
  sectionsOf,
  SkillSchema,
  toBand,
} from '@linmaster/shared';

const ielts = CERTIFICATIONS.IELTS_ACADEMIC;

describe('certification registry', () => {
  it('has one entry per certification key, each with every skill', () => {
    expect(Object.keys(CERTIFICATIONS)).toEqual(CertificationIdSchema.options);
    for (const certification of Object.values(CERTIFICATIONS)) {
      for (const skill of SkillSchema.options) expect(certification.sections[skill].skill).toBe(skill);
    }
  });

  it('looks up a stored key and ignores unknown ones', () => {
    expect(getCertification('IELTS_ACADEMIC')).toBe(ielts);
    expect(getCertification('TOEIC')).toBeUndefined();
    expect(getCertification('')).toBeUndefined();
  });

  it('describes IELTS Academic Listening and Reading (PLAN C4)', () => {
    expect(ielts.sections.listening).toMatchObject({parts: 4, questionCount: 40, durationSec: 1800, reviewSec: 120});
    expect(ielts.sections.reading).toMatchObject({parts: 3, questionCount: 40, durationSec: 3600, reviewSec: 0});
    expect(ielts.sections.listening.questionKinds).not.toContain('tfng');
    expect(ielts.sections.reading.questionKinds).toEqual(expect.arrayContaining([...QuestionKindSchema.options]));
  });

  it('lists sections in sitting order and adds up the attempt time', () => {
    expect(sectionsOf(ielts, 'full').map(section => section.skill)).toEqual(['listening', 'reading']);
    expect(sectionsOf(ielts, 'reading').map(section => section.skill)).toEqual(['reading']);
    expect(attemptDurationSec(ielts, 'listening')).toBe(32 * 60);
    expect(attemptDurationSec(ielts, 'reading')).toBe(60 * 60);
    expect(attemptDurationSec(ielts, 'full')).toBe(92 * 60);
  });
});

describe('band tables', () => {
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
