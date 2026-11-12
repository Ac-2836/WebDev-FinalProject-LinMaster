import {describe, expect, it} from 'vitest';
import {
  attemptDurationSec,
  CERTIFICATIONS,
  CertificationIdSchema,
  getCertification,
  QuestionKindSchema,
  sectionsOf,
  SkillSchema,
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
