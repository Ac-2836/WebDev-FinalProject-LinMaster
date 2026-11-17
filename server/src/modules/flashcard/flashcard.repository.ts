import type {
  CreateFlashcardSet,
  FlashcardCard,
  FlashcardSet,
  FlashcardVisibility,
  ReplaceFlashcardCardInput,
  UpdateFlashcardSet,
} from '@linmaster/shared';
import type {Prisma} from '../../generated/prisma/client';
import {getDb} from '../../core/db';

export type FlashcardSetSummary = {
  id: string;
  title: string;
  description: string | null;
  termLang: string;
  definitionLang: string;
  visibility: FlashcardVisibility;
  createdAt: Date;
  updatedAt: Date;
  _count: {cards: number};
};

export interface FlashcardRepository {
  createSet(ownerId: string, input: CreateFlashcardSet, cards?: ReplaceFlashcardCardInput[]): Promise<FlashcardSet>;
  listSets(ownerId: string): Promise<FlashcardSetSummary[]>;
  findSet(ownerId: string, id: string): Promise<FlashcardSet | null>;
  /** A set of the user, or a public set of anyone (hidden and private sets of others stay unreadable). */
  findReadableSet(userId: string, id: string): Promise<FlashcardSet | null>;
  updateSet(ownerId: string, id: string, input: UpdateFlashcardSet): Promise<FlashcardSet | null>;
  deleteSet(ownerId: string, id: string): Promise<boolean>;
  replaceCards(ownerId: string, setId: string, cards: ReplaceFlashcardCardInput[]): Promise<FlashcardCard[] | null>;
}

const includeCards = {cards: {orderBy: [{position: 'asc' as const}, {id: 'asc' as const}]}};
type SetWithCards = Prisma.FlashcardSetGetPayload<{include: typeof includeCards}>;
type CardRecord = Prisma.CardGetPayload<Record<string, never>>;

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

function toSet(set: SetWithCards): FlashcardSet {
  return {
    id: set.id,
    title: set.title,
    description: set.description,
    termLang: set.termLang,
    definitionLang: set.definitionLang,
    visibility: set.visibility,
    createdAt: set.createdAt.toISOString(),
    updatedAt: set.updatedAt.toISOString(),
    cards: set.cards.map(toCard),
  };
}

function toSetData(
  input: CreateFlashcardSet,
): Pick<Prisma.FlashcardSetUncheckedCreateInput, 'title' | 'description' | 'termLang' | 'definitionLang'> {
  return {
    title: input.title,
    description: input.description ?? null,
    termLang: input.termLang,
    definitionLang: input.definitionLang,
  };
}

function toCardData(
  card: ReplaceFlashcardCardInput,
  position: number,
): Pick<Prisma.CardUncheckedCreateInput, 'term' | 'definition' | 'example' | 'vocabEntryId' | 'position'> {
  return {
    term: card.term,
    definition: card.definition,
    example: card.example ?? null,
    vocabEntryId: card.vocabEntryId ?? null,
    position,
  };
}

export const prismaFlashcardRepository: FlashcardRepository = {
  async createSet(ownerId, input, cards = []) {
    const set = await getDb().flashcardSet.create({
      data: {
        ...toSetData(input),
        ownerId,
        cards: {create: cards.map((card, position) => toCardData(card, position))},
      },
      include: includeCards,
    });
    return toSet(set);
  },

  async listSets(ownerId) {
    return getDb().flashcardSet.findMany({
      where: {ownerId},
      select: {
        id: true,
        title: true,
        description: true,
        termLang: true,
        definitionLang: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        _count: {select: {cards: true}},
      },
      orderBy: [{updatedAt: 'desc'}, {id: 'asc'}],
    });
  },

  async findSet(ownerId, id) {
    const set = await getDb().flashcardSet.findFirst({where: {id, ownerId}, include: includeCards});
    return set ? toSet(set) : null;
  },

  async findReadableSet(userId, id) {
    const set = await getDb().flashcardSet.findFirst({
      where: {id, OR: [{ownerId: userId}, {visibility: 'public'}]},
      include: includeCards,
    });
    return set ? toSet(set) : null;
  },

  async updateSet(ownerId, id, input) {
    const result = await getDb().flashcardSet.updateMany({where: {id, ownerId}, data: input});
    if (result.count === 0) return null;
    const set = await getDb().flashcardSet.findFirstOrThrow({where: {id, ownerId}, include: includeCards});
    return toSet(set);
  },

  async deleteSet(ownerId, id) {
    const result = await getDb().flashcardSet.deleteMany({where: {id, ownerId}});
    return result.count > 0;
  },

  async replaceCards(ownerId, setId, cards) {
    return getDb().$transaction(async tx => {
      const set = await tx.flashcardSet.findFirst({where: {id: setId, ownerId}, select: {id: true}});
      if (!set) return null;

      const requestedIds = cards.flatMap(card => (card.id ? [card.id] : []));
      if (requestedIds.length > 0) {
        const existingCards = await tx.card.findMany({
          where: {id: {in: requestedIds}, setId},
          select: {id: true},
        });
        if (existingCards.length !== requestedIds.length) throw new FlashcardCardNotFoundError();
      }

      const vocabEntryIds = [...new Set(cards.flatMap(card => (card.vocabEntryId ? [card.vocabEntryId] : [])))];
      if (vocabEntryIds.length > 0) {
        const ownedEntries = await tx.vocabEntry.findMany({
          where: {id: {in: vocabEntryIds}, ownerId},
          select: {id: true},
        });
        if (ownedEntries.length !== vocabEntryIds.length) throw new FlashcardVocabEntryNotFoundError();
      }

      const retainedIds: string[] = [];
      for (const [position, card] of cards.entries()) {
        const data = toCardData(card, position);
        if (card.id) {
          await tx.card.update({where: {id: card.id}, data});
          retainedIds.push(card.id);
        } else {
          const createdCard = await tx.card.create({data: {...data, setId}, select: {id: true}});
          retainedIds.push(createdCard.id);
        }
      }

      await tx.card.deleteMany({
        where: {setId, ...(retainedIds.length > 0 ? {id: {notIn: retainedIds}} : {})},
      });
      // Editing cards counts as editing the set, so it moves to the top of the list (ordered by updatedAt).
      await tx.flashcardSet.update({where: {id: setId}, data: {updatedAt: new Date()}});

      const updatedSet = await tx.flashcardSet.findFirstOrThrow({where: {id: setId, ownerId}, include: includeCards});
      return updatedSet.cards.map(toCard);
    });
  },
};

export class FlashcardCardNotFoundError extends Error {
  constructor() {
    super('Card not found in this set.');
    this.name = 'FlashcardCardNotFoundError';
  }
}

export class FlashcardVocabEntryNotFoundError extends Error {
  constructor() {
    super('Vocabulary entry not found.');
    this.name = 'FlashcardVocabEntryNotFoundError';
  }
}
