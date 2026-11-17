export interface PastedCard {
  term: string;
  definition: string;
}

/**
 * Cards from pasted text, one per line as `term<Tab>definition` (what Excel, Google Sheets and Quizlet put on the
 * clipboard). Blank lines are ignored; a line without a Tab or with an empty side is counted in `skipped`.
 */
export function parsePasted(text: string): {cards: PastedCard[]; skipped: number} {
  const cards: PastedCard[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    const term = tab < 0 ? '' : line.slice(0, tab).trim();
    const definition = tab < 0 ? '' : line.slice(tab + 1).trim();
    if (term && definition) cards.push({term, definition});
    else skipped++;
  }
  return {cards, skipped};
}
