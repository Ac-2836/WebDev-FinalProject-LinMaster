import type {ListVocabEntriesQuery, SaveVocabEntry, VocabEntry} from '@linmaster/shared';
import {Prisma} from '../../generated/prisma/client';
import {escapeLike} from '../../core/like';
import {getDb} from '../../core/db';

export interface VocabRepository {
  saveEntry(ownerId: string, input: SaveVocabEntry): Promise<VocabEntry>;
  saveEntries(ownerId: string, inputs: SaveVocabEntry[]): Promise<VocabEntry[]>;
  listEntries(ownerId: string, query: ListVocabEntriesQuery): Promise<{entries: VocabEntry[]; total: number}>;
  findEntry(ownerId: string, id: string): Promise<VocabEntry | null>;
  updateNote(ownerId: string, id: string, note: string | null): Promise<VocabEntry | null>;
  deleteEntry(ownerId: string, id: string): Promise<boolean>;
  getEntriesForUser(ownerId: string, ids: string[]): Promise<VocabEntry[]>;
}

type EntryWithContexts = {
  id: string;
  headword: string;
  lemma: string;
  partOfSpeech: string;
  ipa: string | null;
  meaningVi: string;
  definitionEn: string | null;
  usageNote: string | null;
  collocations: string[];
  cefr: VocabEntry['cefr'];
  topics: string[];
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  contexts: Array<{
    id: string;
    documentId: string | null;
    sentence: string;
    startOffset: number | null;
    endOffset: number | null;
    sourceUrl: string | null;
    createdAt: Date;
  }>;
};

function toEntryDto(entry: EntryWithContexts): VocabEntry {
  return {
    id: entry.id,
    headword: entry.headword,
    lemma: entry.lemma,
    partOfSpeech: entry.partOfSpeech,
    ipa: entry.ipa,
    meaningVi: entry.meaningVi,
    definitionEn: entry.definitionEn,
    usageNote: entry.usageNote,
    collocations: entry.collocations,
    cefr: entry.cefr,
    topics: entry.topics,
    note: entry.note,
    contexts: entry.contexts.map(context => ({
      id: context.id,
      documentId: context.documentId,
      sentence: context.sentence,
      startOffset: context.startOffset,
      endOffset: context.endOffset,
      sourceUrl: context.sourceUrl,
      createdAt: context.createdAt.toISOString(),
    })),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function entryData(ownerId: string, input: SaveVocabEntry): Prisma.VocabEntryUncheckedCreateInput {
  return {
    ownerId,
    headword: input.headword,
    lemma: input.lemma,
    partOfSpeech: input.partOfSpeech,
    ipa: input.ipa ?? null,
    meaningVi: input.meaningVi,
    definitionEn: input.definitionEn ?? null,
    usageNote: input.usageNote ?? null,
    collocations: input.collocations ?? [],
    cefr: input.cefr ?? null,
    topics: input.topics ?? [],
  };
}

function entryWhere(ownerId: string, query: ListVocabEntriesQuery): Prisma.VocabEntryWhereInput {
  const where: Prisma.VocabEntryWhereInput = {ownerId};
  if (query.q) {
    const q = escapeLike(query.q);
    where.OR = [
      {headword: {contains: q, mode: 'insensitive'}},
      {lemma: {contains: q, mode: 'insensitive'}},
      {meaningVi: {contains: q, mode: 'insensitive'}},
      {definitionEn: {contains: q, mode: 'insensitive'}},
    ];
  }
  if (query.topic) where.topics = {has: query.topic};
  if (query.cefr) where.cefr = query.cefr;
  if (query.documentId) where.contexts = {some: {documentId: query.documentId}};
  return where;
}

const includeContexts = {contexts: {orderBy: {createdAt: 'asc' as const}}};

type VocabTransaction = Prisma.TransactionClient;

async function assertOwnedDocuments(tx: VocabTransaction, ownerId: string, inputs: SaveVocabEntry[]): Promise<void> {
  const documentIds = [
    ...new Set(inputs.flatMap(input => (input.context?.documentId ? [input.context.documentId] : []))),
  ];
  if (documentIds.length === 0) return;

  const documents = await tx.document.findMany({
    where: {id: {in: documentIds}, ownerId},
    select: {id: true},
  });
  if (documents.length !== documentIds.length) throw new VocabDocumentNotFoundError();
}

async function saveEntryInTransaction(
  tx: VocabTransaction,
  ownerId: string,
  input: SaveVocabEntry,
): Promise<EntryWithContexts> {
  const saved = await tx.vocabEntry.upsert({
    where: {ownerId_lemma_partOfSpeech: {ownerId, lemma: input.lemma, partOfSpeech: input.partOfSpeech}},
    create: entryData(ownerId, input),
    update: {},
    include: includeContexts,
  });

  if (input.context) {
    const existingContext = await tx.vocabContext.findFirst({
      where: {
        entryId: saved.id,
        sentence: input.context.sentence,
        documentId: input.context.documentId ?? null,
        startOffset: input.context.startOffset ?? null,
        endOffset: input.context.endOffset ?? null,
        sourceUrl: input.context.sourceUrl ?? null,
      },
      select: {id: true},
    });
    if (!existingContext) {
      await tx.vocabContext.create({
        data: {
          entryId: saved.id,
          documentId: input.context.documentId,
          sentence: input.context.sentence,
          startOffset: input.context.startOffset,
          endOffset: input.context.endOffset,
          sourceUrl: input.context.sourceUrl,
        },
      });
    }
  }

  return tx.vocabEntry.findUniqueOrThrow({where: {id: saved.id}, include: includeContexts});
}

export const prismaVocabRepository: VocabRepository = {
  async saveEntry(ownerId, input) {
    const [entry] = await this.saveEntries(ownerId, [input]);
    return entry;
  },

  async saveEntries(ownerId, inputs) {
    const entries = await getDb().$transaction(async tx => {
      await assertOwnedDocuments(tx, ownerId, inputs);
      const saved = new Map<string, EntryWithContexts>();
      for (const input of inputs) {
        const entry = await saveEntryInTransaction(tx, ownerId, input);
        saved.set(entry.id, entry);
      }
      return [...saved.values()];
    });
    return entries.map(toEntryDto);
  },

  async listEntries(ownerId, query) {
    const where = entryWhere(ownerId, query);
    const [entries, total] = await Promise.all([
      getDb().vocabEntry.findMany({
        where,
        include: includeContexts,
        orderBy: [{updatedAt: 'desc'}, {id: 'asc'}],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      getDb().vocabEntry.count({where}),
    ]);
    return {entries: entries.map(toEntryDto), total};
  },

  async findEntry(ownerId, id) {
    const entry = await getDb().vocabEntry.findFirst({where: {id, ownerId}, include: includeContexts});
    return entry ? toEntryDto(entry) : null;
  },

  async updateNote(ownerId, id, note) {
    const result = await getDb().vocabEntry.updateMany({where: {id, ownerId}, data: {note}});
    if (result.count === 0) return null;
    return this.findEntry(ownerId, id);
  },

  async deleteEntry(ownerId, id) {
    const result = await getDb().vocabEntry.deleteMany({where: {id, ownerId}});
    return result.count > 0;
  },

  async getEntriesForUser(ownerId, ids) {
    if (ids.length === 0) return [];
    const entries = await getDb().vocabEntry.findMany({where: {ownerId, id: {in: ids}}, include: includeContexts});
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    return ids.flatMap(id => {
      const entry = byId.get(id);
      return entry ? [toEntryDto(entry)] : [];
    });
  },
};

export class VocabDocumentNotFoundError extends Error {
  constructor() {
    super('Document not found.');
    this.name = 'VocabDocumentNotFoundError';
  }
}
