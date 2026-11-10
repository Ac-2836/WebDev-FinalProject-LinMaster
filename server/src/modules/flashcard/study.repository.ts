import type {FlashcardCard, Rating, StudyMode} from '@linmaster/shared';
import type {Prisma} from '../../generated/prisma/client';
import {getDb} from '../../core/db';
import type {ScheduledReview, Sm2State} from './flashcard.scheduler';

export interface ProgressRecord extends Sm2State {
  cardId: string;
  dueAt: Date;
  lastReviewedAt: Date | null;
}

export interface StudyCardRecord {
  card: FlashcardCard;
  progress: ProgressRecord | null;
}

export interface SessionRecord {
  id: string;
  setId: string;
  mode: StudyMode;
  startedAt: Date;
  endedAt: Date | null;
  cardsStudied: number;
  correctCount: number;
}

export interface ReviewInput {
  rating: Rating;
  sessionId: string | null;
  now: Date;
  /** Computes the next SM-2 state from the stored one, inside the same transaction. */
  schedule(previous: Sm2State | null): ScheduledReview;
}

export interface DueSetCount {
  setId: string;
  title: string;
  dueCount: number;
}

export interface StudyRepository {
  isSetOwner(ownerId: string, setId: string): Promise<boolean>;
  /** Cards with progress due before `dueBefore`, oldest due first. */
  listDueCards(userId: string, setId: string, dueBefore: Date, limit: number): Promise<StudyCardRecord[]>;
  /** Cards the learner has never rated, in set order. */
  listNewCards(userId: string, setId: string, limit: number): Promise<FlashcardCard[]>;
  /** Cards of the set whose first ever review by the learner falls in [from, to). */
  countNewCardsStarted(userId: string, setId: string, from: Date, to: Date): Promise<number>;
  /** Set of a card the learner owns, or null. */
  findCardSetId(userId: string, cardId: string): Promise<string | null>;
  reviewCard(userId: string, cardId: string, input: ReviewInput): Promise<ProgressRecord>;
  createSession(userId: string, setId: string, mode: StudyMode, now: Date): Promise<SessionRecord>;
  findSession(userId: string, id: string): Promise<SessionRecord | null>;
  listSessionReviews(sessionId: string): Promise<Array<{cardId: string; rating: Rating}>>;
  /** Closes an open session; null when it does not exist or is already closed. */
  endSession(
    userId: string,
    id: string,
    counts: {cardsStudied: number; correctCount: number},
    now: Date,
  ): Promise<SessionRecord | null>;
  dueSetCounts(userId: string, dueBefore: Date): Promise<DueSetCount[]>;
}

type CardRecord = Prisma.CardGetPayload<Record<string, never>>;
type CardProgressRecord = Prisma.CardProgressGetPayload<Record<string, never>>;
type StudySessionRecord = Prisma.StudySessionGetPayload<Record<string, never>>;

function toCard(card: CardRecord): FlashcardCard {
  return {
    id: card.id,
    term: card.term,
    definition: card.definition,
    example: card.example,
    vocabEntryId: card.vocabEntryId,
    position: card.position,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

function toProgress(progress: CardProgressRecord): ProgressRecord {
  return {
    cardId: progress.cardId,
    easiness: progress.easiness,
    intervalDays: progress.intervalDays,
    repetitions: progress.repetitions,
    lapses: progress.lapses,
    dueAt: progress.dueAt,
    lastReviewedAt: progress.lastReviewedAt,
  };
}

function toSession(session: StudySessionRecord): SessionRecord {
  return {
    id: session.id,
    setId: session.setId,
    mode: session.mode,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    cardsStudied: session.cardsStudied,
    correctCount: session.correctCount,
  };
}

export const prismaStudyRepository: StudyRepository = {
  async isSetOwner(ownerId, setId) {
    return (await getDb().flashcardSet.count({where: {id: setId, ownerId}})) > 0;
  },

  async listDueCards(userId, setId, dueBefore, limit) {
    const rows = await getDb().cardProgress.findMany({
      where: {userId, dueAt: {lt: dueBefore}, card: {setId, set: {ownerId: userId}}},
      include: {card: true},
      orderBy: [{dueAt: 'asc'}, {cardId: 'asc'}],
      take: limit,
    });
    return rows.map(row => ({card: toCard(row.card), progress: toProgress(row)}));
  },

  async listNewCards(userId, setId, limit) {
    if (limit <= 0) return [];
    const cards = await getDb().card.findMany({
      where: {setId, set: {ownerId: userId}, progress: {none: {userId}}},
      orderBy: [{position: 'asc'}, {id: 'asc'}],
      take: limit,
    });
    return cards.map(toCard);
  },

  async countNewCardsStarted(userId, setId, from, to) {
    const reviewedToday = await getDb().reviewLog.findMany({
      where: {userId, card: {setId}, reviewedAt: {gte: from, lt: to}},
      distinct: ['cardId'],
      select: {cardId: true},
    });
    if (reviewedToday.length === 0) return 0;
    const reviewedBefore = await getDb().reviewLog.findMany({
      where: {userId, cardId: {in: reviewedToday.map(row => row.cardId)}, reviewedAt: {lt: from}},
      distinct: ['cardId'],
      select: {cardId: true},
    });
    return reviewedToday.length - reviewedBefore.length;
  },

  async findCardSetId(userId, cardId) {
    const card = await getDb().card.findFirst({where: {id: cardId, set: {ownerId: userId}}, select: {setId: true}});
    return card?.setId ?? null;
  },

  async reviewCard(userId, cardId, {rating, sessionId, now, schedule}) {
    return getDb().$transaction(async tx => {
      const where = {userId_cardId: {userId, cardId}};
      const existing = await tx.cardProgress.findUnique({where});
      const previous = existing ? toProgress(existing) : null;
      const next = schedule(previous);
      const data = {
        easiness: next.easiness,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        lapses: next.lapses,
        dueAt: next.dueAt,
        lastReviewedAt: now,
      };
      const saved = await tx.cardProgress.upsert({where, create: {userId, cardId, ...data}, update: data});
      await tx.reviewLog.create({
        data: {
          userId,
          cardId,
          sessionId,
          rating,
          intervalBefore: previous?.intervalDays ?? 0,
          intervalAfter: next.intervalDays,
          // Server clock, the same one used for the Vietnam-day limits.
          reviewedAt: now,
        },
      });
      return toProgress(saved);
    });
  },

  async createSession(userId, setId, mode, now) {
    return toSession(await getDb().studySession.create({data: {userId, setId, mode, startedAt: now}}));
  },

  async findSession(userId, id) {
    const session = await getDb().studySession.findFirst({where: {id, userId}});
    return session ? toSession(session) : null;
  },

  async listSessionReviews(sessionId) {
    return getDb().reviewLog.findMany({
      where: {sessionId},
      select: {cardId: true, rating: true},
      orderBy: {reviewedAt: 'asc'},
    });
  },

  async endSession(userId, id, counts, now) {
    const result = await getDb().studySession.updateMany({
      where: {id, userId, endedAt: null},
      data: {...counts, endedAt: now},
    });
    if (result.count === 0) return null;
    return toSession(await getDb().studySession.findFirstOrThrow({where: {id, userId}}));
  },

  async dueSetCounts(userId, dueBefore) {
    const groups = await getDb().card.groupBy({
      by: ['setId'],
      where: {set: {ownerId: userId}, progress: {some: {userId, dueAt: {lt: dueBefore}}}},
      _count: {_all: true},
    });
    if (groups.length === 0) return [];
    const sets = await getDb().flashcardSet.findMany({
      where: {id: {in: groups.map(group => group.setId)}, ownerId: userId},
      select: {id: true, title: true},
    });
    const titles = new Map(sets.map(set => [set.id, set.title]));
    return groups.flatMap(group => {
      const title = titles.get(group.setId);
      return title === undefined ? [] : [{setId: group.setId, title, dueCount: group._count._all}];
    });
  },
};
