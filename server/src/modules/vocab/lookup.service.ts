import type {LookupWordRequest, LookupWordResponse, WordExplanation} from '@linmaster/shared';

import {runJsonTask} from '../../core/ai/ai-gateway';
import {AppError} from '../../core/app-error';
import {getDb} from '../../core/db';
import {type ExplainWordInput, explainWordTask} from './ai/explain-word.v1';
import {prismaVocabDocumentRepository} from './documents.repository';

export interface LookupDeps {
  explain(input: ExplainWordInput, userId: string): Promise<WordExplanation>;
  ownsDocument(userId: string, documentId: string): Promise<boolean>;
  findEntryId(userId: string, lemma: string, partOfSpeech: string): Promise<string | null>;
  recordLookup(userId: string, input: LookupWordRequest): Promise<void>;
}

export const prismaLookupDeps: LookupDeps = {
  explain: (input, userId) => runJsonTask(explainWordTask, input, {userId}),
  async ownsDocument(userId, documentId) {
    return (await prismaVocabDocumentRepository.getDocumentForUser(userId, documentId)) !== null;
  },
  async findEntryId(ownerId, lemma, partOfSpeech) {
    const entry = await getDb().vocabEntry.findUnique({
      where: {ownerId_lemma_partOfSpeech: {ownerId, lemma, partOfSpeech}},
      select: {id: true},
    });
    return entry?.id ?? null;
  },
  async recordLookup(ownerId, {text, sentence, documentId}) {
    await getDb().vocabLookup.create({data: {ownerId, text, sentence, documentId, saved: false}});
  },
};

/** POST /vocab/lookups: explains a word in its sentence through `explain-word.v1` (seq-02-tra-tu). */
export function createLookupService(deps: LookupDeps = prismaLookupDeps) {
  return {
    async lookup(userId: string, input: LookupWordRequest): Promise<LookupWordResponse> {
      if (input.documentId && !(await deps.ownsDocument(userId, input.documentId))) {
        throw new AppError('Document not found.', 404);
      }

      const raw = await deps.explain({text: input.text, sentence: input.sentence}, userId);
      // Same normalisation as SaveVocabEntrySchema, so the word bank lookup below matches a saved entry.
      const explanation: WordExplanation = {
        ...raw,
        lemma: raw.lemma.trim().toLowerCase(),
        partOfSpeech: raw.partOfSpeech.trim().toLowerCase(),
        topics: raw.topics.map(topic => topic.trim().toLowerCase()),
      };

      await deps.recordLookup(userId, input);
      const savedEntryId = await deps.findEntryId(userId, explanation.lemma, explanation.partOfSpeech);
      return {explanation, savedEntryId};
    },
  };
}
