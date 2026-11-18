import {createFormatter} from 'next-intl';
import {describe, expect, it, vi} from 'vitest';

vi.mock('next/headers', () => ({cookies: async () => ({get: () => undefined})}));
vi.mock('next-intl/server', () => ({getRequestConfig: (fn: unknown) => fn}));

import config from './request';

describe('request config', () => {
  it('shows times in Vietnam, not in the UTC of the server', async () => {
    const {locale, timeZone} = await (config as unknown as () => Promise<{locale: string; timeZone: string}>)();
    const shown = createFormatter({locale, timeZone}).dateTime(new Date('2026-11-18T03:55:00Z'), {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    expect(shown).toBe('10:55');
  });
});
