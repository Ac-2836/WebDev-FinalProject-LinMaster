import type {VocabDocument, VocabDocumentDetail} from '@linmaster/shared';
import {Prisma} from '../../generated/prisma/client';
import {getDb} from '../../core/db';

export type DocumentParagraphs = VocabDocument['paragraphs'];

export interface ExamSourceRef {
  attemptId: string;
  passageId: string;
}

export interface VocabDocumentRepository {
  createDocument(
    ownerId: string,
    input: {
      title: string;
      source: VocabDocument['source'];
      paragraphs: DocumentParagraphs;
      wordCount: number;
      /** For source `exam`: where the text comes from. */
      sourceRef?: ExamSourceRef;
    },
  ): Promise<VocabDocument>;
  /** The document already made from this passage of this attempt, if any. */
  findExamDocument(ownerId: string, sourceRef: ExamSourceRef): Promise<VocabDocument | null>;
  listDocuments(ownerId: string): Promise<Array<Omit<VocabDocument, 'paragraphs'>>>;
  findDocument(ownerId: string, id: string): Promise<VocabDocumentDetail | null>;
  getDocumentForUser(ownerId: string, id: string): Promise<VocabDocument | null>;
  deleteDocument(ownerId: string, id: string): Promise<boolean>;
}

type DocumentRecord = {
  id: string;
  title: string;
  source: VocabDocument['source'];
  paragraphs: unknown;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDocument(record: DocumentRecord): VocabDocument {
  return {
    id: record.id,
    title: record.title,
    source: record.source,
    paragraphs: record.paragraphs as DocumentParagraphs,
    wordCount: record.wordCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const prismaVocabDocumentRepository: VocabDocumentRepository = {
  async createDocument(ownerId, input) {
    const document = await getDb().document.create({
      data: {
        ...input,
        ownerId,
        paragraphs: input.paragraphs as Prisma.InputJsonValue,
        sourceRef: input.sourceRef ? {...input.sourceRef} : Prisma.DbNull,
      },
    });
    return toDocument(document);
  },

  async findExamDocument(ownerId, {attemptId, passageId}) {
    const document = await getDb().document.findFirst({
      where: {ownerId, source: 'exam', sourceRef: {equals: {attemptId, passageId}}},
      orderBy: {createdAt: 'asc'},
    });
    return document ? toDocument(document) : null;
  },

  async listDocuments(ownerId) {
    const documents = await getDb().document.findMany({
      where: {ownerId},
      orderBy: [{updatedAt: 'desc'}, {id: 'asc'}],
      select: {id: true, title: true, source: true, wordCount: true, createdAt: true, updatedAt: true},
    });
    return documents.map(document => ({
      id: document.id,
      title: document.title,
      source: document.source,
      wordCount: document.wordCount,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    }));
  },

  async findDocument(ownerId, id) {
    const document = await getDb().document.findFirst({where: {id, ownerId}});
    if (!document) return null;

    const contexts = await getDb().vocabContext.findMany({
      where: {documentId: id, entry: {ownerId}},
      orderBy: [{startOffset: 'asc'}, {createdAt: 'asc'}],
      select: {
        entryId: true,
        sentence: true,
        startOffset: true,
        endOffset: true,
        entry: {select: {headword: true, lemma: true}},
      },
    });
    const entriesById = new Map<string, VocabDocumentDetail['entries'][number]>();
    for (const context of contexts) {
      const entry = entriesById.get(context.entryId) ?? {
        id: context.entryId,
        headword: context.entry.headword,
        lemma: context.entry.lemma,
        contexts: [],
      };
      entry.contexts.push({
        sentence: context.sentence,
        startOffset: context.startOffset,
        endOffset: context.endOffset,
      });
      entriesById.set(context.entryId, entry);
    }

    return {...toDocument(document), entries: [...entriesById.values()]};
  },

  async getDocumentForUser(ownerId, id) {
    const document = await getDb().document.findFirst({where: {id, ownerId}});
    return document ? toDocument(document) : null;
  },

  async deleteDocument(ownerId, id) {
    const result = await getDb().document.deleteMany({where: {id, ownerId}});
    return result.count > 0;
  },
};
