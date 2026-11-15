import {getDb} from '../../core/db';

export interface StudyStats {
  /** When each card rating was given, any order. */
  reviewTimes: Date[];
  /** Ended study sessions. */
  sessions: Array<{startedAt: Date; endedAt: Date}>;
  /** SM-2 interval of the user's rated cards that come from a saved word. */
  entryIntervals: Array<{vocabEntryId: string; intervalDays: number}>;
}

/**
 * Public API for the stats module: the user's reviews, study time and card progress per saved word.
 * shortcut: loads every row of the user and lets stats group by day; move the grouping into SQL if it grows large.
 */
export async function getStudyStats(userId: string): Promise<StudyStats> {
  const db = getDb();
  const [reviews, sessions, progress] = await Promise.all([
    db.reviewLog.findMany({where: {userId}, select: {reviewedAt: true}}),
    db.studySession.findMany({where: {userId, endedAt: {not: null}}, select: {startedAt: true, endedAt: true}}),
    db.cardProgress.findMany({
      where: {userId, card: {vocabEntryId: {not: null}}},
      select: {intervalDays: true, card: {select: {vocabEntryId: true}}},
    }),
  ]);
  return {
    reviewTimes: reviews.map(row => row.reviewedAt),
    sessions: sessions.map(row => ({startedAt: row.startedAt, endedAt: row.endedAt!})),
    entryIntervals: progress.map(row => ({vocabEntryId: row.card.vocabEntryId!, intervalDays: row.intervalDays})),
  };
}

/** Public API for the stats module: the user's public sets and how many times others copied any of their sets. */
export async function getSetCommunityStats(userId: string): Promise<{published: number; copies: number}> {
  const db = getDb();
  const [published, copies] = await Promise.all([
    db.flashcardSet.count({where: {ownerId: userId, visibility: 'public'}}),
    db.flashcardSet.aggregate({where: {ownerId: userId}, _sum: {copyCount: true}}),
  ]);
  return {published, copies: copies._sum.copyCount ?? 0};
}
