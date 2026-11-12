import {describe, expect, it} from 'vitest';
import {CreateImportRequestSchema, ImportStatusSchema, MAX_IMPORT_FILES} from '@linmaster/shared';
import {ImportStatus} from '../../src/generated/prisma/enums';

const id = (n: number) => `0192f7e0-0bcd-7000-8000-${String(n).padStart(12, '0')}`;
const files = (count: number) => Array.from({length: count}, (_, n) => ({fileId: id(n + 1)}));

describe('test import schemas', () => {
  it('accepts 1 to 10 files, with or without a box', () => {
    expect(CreateImportRequestSchema.safeParse({kind: 'full', files: files(MAX_IMPORT_FILES)}).success).toBe(true);
    expect(
      CreateImportRequestSchema.safeParse({kind: 'reading', files: [{fileId: id(1), slot: 'answers'}]}).success,
    ).toBe(true);
  });

  it('rejects no file, more than 10 files, a repeated file, an unknown box or extra fields', () => {
    for (const body of [
      {kind: 'reading', files: []},
      {kind: 'reading', files: files(MAX_IMPORT_FILES + 1)},
      {kind: 'reading', files: [{fileId: id(1)}, {fileId: id(1)}]},
      {kind: 'reading', files: [{fileId: id(1), slot: 'cover'}]},
      {kind: 'speaking', files: files(1)},
      {kind: 'reading', files: files(1), title: 'x'},
    ]) {
      expect(CreateImportRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });

  it('uses the same import statuses as the database', () => {
    expect([...ImportStatusSchema.options].sort()).toEqual(Object.values(ImportStatus).sort());
  });
});
