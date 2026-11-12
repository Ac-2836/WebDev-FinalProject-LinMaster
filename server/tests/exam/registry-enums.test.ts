import {describe, expect, it} from 'vitest';
import {QuestionKindSchema, SkillSchema, TestKindSchema} from '@linmaster/shared';
import {QuestionKind, Skill, TestKind} from '../../src/generated/prisma/enums';

// The registries in shared/exam and the database enums must name the same values (no database needed).
describe('exam registry keys match the database enums', () => {
  it.each([
    ['QuestionKind', QuestionKindSchema.options, QuestionKind],
    ['Skill', SkillSchema.options, Skill],
    ['TestKind', TestKindSchema.options, TestKind],
  ])('%s', (_name, shared, database) => {
    expect([...shared].sort()).toEqual(Object.values(database).sort());
  });
});
