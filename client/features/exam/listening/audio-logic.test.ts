import {describe, expect, it} from 'vitest';

import {needsResync, resumePoint} from './audio-logic';

describe('listening audio', () => {
  it('plays from the start at the beginning of the section', () => {
    expect(resumePoint(500_000, 1, 840)).toEqual({skipBytes: 0, startSec: 0});
  });

  it('skips to the position after a refresh, from the bytes per second of the first chunk', () => {
    // 600 s played + 30 s lead = 630 s in 5 040 000 bytes: 8 000 bytes per second.
    expect(resumePoint(5_040_000, 600, 840)).toEqual({skipBytes: 8_000 * 598, startSec: 598});
  });

  it('caps the covered time at the length of the file', () => {
    // 830 s played: the chunk is the whole file (840 s).
    expect(resumePoint(840 * 8_000, 830, 840).skipBytes).toBe(8_000 * 828);
  });

  it('starts from 0 when the length is unknown', () => {
    expect(resumePoint(1_000, 600, null)).toEqual({skipBytes: 0, startSec: 0});
  });

  it('corrects only a drift of more than 3 seconds', () => {
    expect(needsResync(100, 102)).toBe(false);
    expect(needsResync(100, 104)).toBe(true);
  });
});
