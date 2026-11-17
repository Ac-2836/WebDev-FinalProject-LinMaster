import {describe, expect, it} from 'vitest';

import {parsePasted} from './paste-cards';

describe('parsePasted', () => {
  it('reads one card per line split at the first Tab', () => {
    expect(parsePasted('mitigate\tgiảm nhẹ\r\nerosion\tsự xói mòn\ta\tb\n')).toEqual({
      cards: [
        {term: 'mitigate', definition: 'giảm nhẹ'},
        {term: 'erosion', definition: 'sự xói mòn\ta\tb'},
      ],
      skipped: 0,
    });
  });

  it('ignores blank lines and counts lines it cannot use', () => {
    const {cards, skipped} = parsePasted('a\tb\n\n   \nno tab here\n\tonly definition\nonly term\t\n');
    expect(cards).toEqual([{term: 'a', definition: 'b'}]);
    expect(skipped).toBe(3);
  });
});
