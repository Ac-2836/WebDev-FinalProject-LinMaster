import {CreateReportRequestSchema, LibraryQuerySchema} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

const ID = '0192f7e0-0bcd-7000-8000-000000000001';

describe('library contract', () => {
  it('fills the browse defaults and reads numbers from the query string', () => {
    expect(LibraryQuerySchema.parse({})).toEqual({type: 'set', sort: 'new', page: 1, pageSize: 20});
    expect(LibraryQuerySchema.parse({type: 'test', skill: 'listening', page: '2', q: ' farm '})).toMatchObject({
      type: 'test',
      skill: 'listening',
      page: 2,
      q: 'farm',
    });
  });

  it('refuses unknown filters, sorts and page sizes over 50', () => {
    expect(LibraryQuerySchema.safeParse({topic: 'environment'}).success).toBe(false);
    expect(LibraryQuerySchema.safeParse({sort: 'old'}).success).toBe(false);
    expect(LibraryQuerySchema.safeParse({pageSize: '51'}).success).toBe(false);
  });

  it('takes a report with a known reason and an optional detail', () => {
    expect(CreateReportRequestSchema.parse({targetType: 'set', targetId: ID, reason: 'copyright'})).toEqual({
      targetType: 'set',
      targetId: ID,
      reason: 'copyright',
    });
    expect(CreateReportRequestSchema.safeParse({targetType: 'set', targetId: ID, reason: 'spam'}).success).toBe(false);
    expect(
      CreateReportRequestSchema.safeParse({targetType: 'set', targetId: ID, reason: 'other', detail: 'x'.repeat(1001)})
        .success,
    ).toBe(false);
  });
});
