import type {LibraryCard, LibrarySetItem, LibrarySort, TestVisibility} from '@linmaster/shared';
import type {Prisma} from '../../generated/prisma/client';

import {getDb} from '../../core/db';

// Public API of flashcard for the library (PLAN C5): only this file changes `visibility`, `publishedAt`, `copyCount`.

export type VisibilityAction = 'publish' | 'unpublish';
export type VisibilityOutcome =
  | {status: 'ok'; visibility: TestVisibility; publishedAt: Date | null; wasHidden: boolean}
  | {status: 'not_found' | 'hidden'};

export interface LibraryPage {
  q?: string;
  sort: LibrarySort;
  skip: number;
  take: number;
}

export type LibrarySetDetail = LibrarySetItem & {ownerId: string; cards: LibraryCard[]};
export type CopyOutcome = {status: 'ok'; setId: string} | {status: 'not_found' | 'own'};

const ITEM = {
  id: true,
  title: true,
  description: true,
  termLang: true,
  definitionLang: true,
  copyCount: true,
  publishedAt: true,
  createdAt: true,
  owner: {select: {id: true, displayName: true}},
  _count: {select: {cards: true}},
} as const;

type ItemRow = Prisma.FlashcardSetGetPayload<{select: typeof ITEM}>;

function toItem({_count, owner, publishedAt, createdAt, ...set}: ItemRow): LibrarySetItem {
  return {
    type: 'set',
    ...set,
    cardCount: _count.cards,
    author: owner,
    publishedAt: (publishedAt ?? createdAt).toISOString(),
  };
}

/**
 * Owner only. Publishing a `hidden` set is refused until it is unpublished (UC40 1a); publishing twice keeps the
 * first `publishedAt`. Unpublishing reports `wasHidden` so the library can close the reports that hid it (st-03).
 */
export async function setLibrarySetVisibility(
  ownerId: string,
  setId: string,
  action: VisibilityAction,
): Promise<VisibilityOutcome> {
  const db = getDb();
  const set = await db.flashcardSet.findFirst({where: {id: setId, ownerId}, select: {visibility: true}});
  if (!set) return {status: 'not_found'};
  if (action === 'publish' && set.visibility === 'hidden') return {status: 'hidden'};
  const data: Prisma.FlashcardSetUpdateInput =
    action === 'unpublish'
      ? {visibility: 'private'}
      : set.visibility === 'public'
        ? {}
        : {visibility: 'public', publishedAt: new Date()};
  const updated = await db.flashcardSet.update({
    where: {id: setId},
    data,
    select: {visibility: true, publishedAt: true},
  });
  return {status: 'ok', ...updated, wasHidden: set.visibility === 'hidden'};
}

/** Public sets only, matching the title or description. */
export async function listLibrarySets({q, sort, skip, take}: LibraryPage) {
  const where: Prisma.FlashcardSetWhereInput = {
    visibility: 'public',
    ...(q && {
      OR: [{title: {contains: q, mode: 'insensitive'}}, {description: {contains: q, mode: 'insensitive'}}],
    }),
  };
  const orderBy: Prisma.FlashcardSetOrderByWithRelationInput[] =
    sort === 'popular'
      ? [{copyCount: 'desc'}, {publishedAt: 'desc'}, {id: 'desc'}]
      : [{publishedAt: 'desc'}, {id: 'desc'}];
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.flashcardSet.findMany({where, orderBy, skip, take, select: ITEM}),
    db.flashcardSet.count({where}),
  ]);
  return {items: rows.map(toItem), total};
}

/** A public set with all its cards; null when it is private, hidden or missing. */
export async function getLibrarySet(setId: string): Promise<LibrarySetDetail | null> {
  const set = await getDb().flashcardSet.findFirst({
    where: {id: setId, visibility: 'public'},
    select: {
      ...ITEM,
      ownerId: true,
      cards: {
        orderBy: {position: 'asc'},
        select: {id: true, position: true, term: true, definition: true, example: true},
      },
    },
  });
  if (!set) return null;
  const {ownerId, cards, ...item} = set;
  return {...toItem(item), ownerId, cards};
}

/** Newest copy of the set in the user's library. */
export async function findLatestCopy(userId: string, setId: string): Promise<string | null> {
  const copy = await getDb().flashcardSet.findFirst({
    where: {ownerId: userId, copiedFromId: setId},
    orderBy: {createdAt: 'desc'},
    select: {id: true},
  });
  return copy?.id ?? null;
}

/**
 * Deep copy of a public set of someone else into a new private set (seq-09). Cards lose their link to the
 * original owner's vocabulary; the copy keeps no tie to the original except `copiedFromId`.
 */
export async function copyLibrarySet(userId: string, setId: string): Promise<CopyOutcome> {
  return getDb().$transaction(async tx => {
    const source = await tx.flashcardSet.findFirst({
      where: {id: setId, visibility: 'public'},
      select: {
        ownerId: true,
        title: true,
        description: true,
        termLang: true,
        definitionLang: true,
        cards: {orderBy: {position: 'asc'}, select: {position: true, term: true, definition: true, example: true}},
      },
    });
    if (!source) return {status: 'not_found'};
    if (source.ownerId === userId) return {status: 'own'};
    const {title, description, termLang, definitionLang, cards} = source;
    const copy = await tx.flashcardSet.create({
      data: {
        title,
        description,
        termLang,
        definitionLang,
        ownerId: userId,
        copiedFromId: setId,
        cards: {createMany: {data: cards}},
      },
      select: {id: true},
    });
    await tx.flashcardSet.update({where: {id: setId}, data: {copyCount: {increment: 1}}});
    return {status: 'ok', setId: copy.id};
  });
}
