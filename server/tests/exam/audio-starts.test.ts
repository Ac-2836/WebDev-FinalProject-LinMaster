import {describe, expect, it} from 'vitest';
import {trustedStarts} from '../../src/modules/exam/audio-starts';

const parts = (...starts: number[]) => starts.map((startSec, index) => ({part: index + 1, startSec}));

describe('trustedStarts', () => {
  it('keeps starts that are in order inside the recording', () => {
    expect(trustedStarts(parts(0, 400, 800, 1200), 4, 1680)).toEqual([0, 400, 800, 1200]);
    expect(trustedStarts(parts(0, 400), 2, null)).toEqual([0, 400]);
  });

  it('drops a start at or after the end of the recording', () => {
    // Part 4 at second 3 of a 3-second recording: the case QA reproduced.
    expect(trustedStarts(parts(0, 1, 2, 3), 4, 3)).toEqual([0, 1, 2, null]);
    expect(trustedStarts(parts(0, 5000), 2, 1680)).toEqual([0, null]);
  });

  it('drops a start before the part before it, and keeps the later ones that fit', () => {
    expect(trustedStarts(parts(0, 800, 400, 1200), 4, 1680)).toEqual([0, 800, null, 1200]);
  });

  it('leaves a part the AI did not give a start for as null', () => {
    expect(trustedStarts([{part: 2, startSec: 400}], 3, 1680)).toEqual([null, 400, null]);
    expect(trustedStarts([], 2, 1680)).toEqual([null, null]);
  });
});
