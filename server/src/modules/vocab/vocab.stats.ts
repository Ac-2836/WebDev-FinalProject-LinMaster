import {getDb} from '../../core/db';

export interface VocabStats {
  /** When each word was looked up, any order. */
  lookupTimes: Date[];
  entries: Array<{id: string; createdAt: Date; topics: string[]}>;
}

/**
 * Public API for the stats module: the user's lookups and saved words.
 * shortcut: loads every row of the user and lets stats group by day; move the grouping into SQL if one user has
 * tens of thousands of rows.
 */
export async function getVocabStats(userId: string): Promise<VocabStats> {
  const db = getDb();
  const [lookups, entries] = await Promise.all([
    db.vocabLookup.findMany({where: {ownerId: userId}, select: {createdAt: true}}),
    db.vocabEntry.findMany({where: {ownerId: userId}, select: {id: true, createdAt: true, topics: true}}),
  ]);
  return {lookupTimes: lookups.map(row => row.createdAt), entries};
}
