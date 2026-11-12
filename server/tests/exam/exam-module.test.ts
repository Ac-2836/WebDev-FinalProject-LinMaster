import {describe, expect, it} from 'vitest';
import {createApiModules} from '../../src/modules';

describe('exam module', () => {
  it('is registered once under /api/v1', () => {
    const exam = createApiModules('test-secret-that-is-at-least-thirty-two-characters').filter(m => m.name === 'exam');
    expect(exam).toHaveLength(1);
    expect(exam[0].basePath).toBe('/api/v1');
  });
});
