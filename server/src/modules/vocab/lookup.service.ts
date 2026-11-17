import type {LookupWordRequest, LookupWordResponse, WordExplanation} from '@linmaster/shared';

import {runJsonTask} from '../../core/ai/ai-gateway';
import {AppError} from '../../core/app-error';
import {getDb} from '../../core/db';
import {type ExplainWordInput, type ExplainWordRetry, explainWordTask} from './ai/explain-word.v2';
import {prismaVocabDocumentRepository} from './documents.repository';
import {droppedMeaning, locatePhrase, selectionRange} from './lookup-match';

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

/** POST /vocab/lookups: explains a word in its sentence through `explain-word.v2` (seq-02-tra-tu). */
export function createLookupService(deps: LookupDeps = prismaLookupDeps) {
  return {
    async lookup(userId: string, input: LookupWordRequest): Promise<LookupWordResponse> {
      if (input.documentId && !(await deps.ownsDocument(userId, input.documentId))) {
        throw new AppError('Document not found.', 404);
      }

      const {text, sentence, context} = input;
      const selection = selectionRange(text, sentence, input.textStart);
      const base = {
        text,
        sentence,
        occurrence: selection.occurrence,
        title: context?.title,
        paragraph: context?.paragraph,
      };

      // The AI may answer with a phrase that is not in the sentence, or cut the selection down to one word. Ask once
      // more with the reason. Still a phrase from nowhere: 502. Still one word: its meaning stays, for the selection.
      let raw: WordExplanation | undefined;
      let found: {start: number; end: number; text: string} | null = null;
      let retry: ExplainWordRetry | undefined;
      for (let attempt = 0; attempt < 2 && !found; attempt++) {
        raw = await deps.explain({...base, retry}, userId);
        found = locatePhrase(raw.headword, sentence, selection);
        if (!found) retry = 'not_in_sentence';
        else if (droppedMeaning({...selection, text}, found)) [found, retry] = [null, 'single_word'];
      }
      // Two phrases that are not in the sentence: their meaning would be for some other text, so it is not shown.
      if (!found && retry === 'not_in_sentence') {
        throw new AppError('AI trả về kết quả không hợp lệ, hãy thử lại.', 502, undefined, 'AI_INVALID_OUTPUT');
      }
      const range = found ?? {
        start: selection.start,
        end: selection.end,
        text: sentence.slice(selection.start, selection.end),
      };
      const match = {...range, adjusted: range.start !== selection.start || range.end !== selection.end};

      // Same normalisation as SaveVocabEntrySchema, so the word bank lookup below matches a saved entry.
      const explanation: WordExplanation = {
        ...raw!,
        headword: match.text,
        lemma: raw!.lemma.trim().toLowerCase(),
        partOfSpeech: raw!.partOfSpeech.trim().toLowerCase(),
        topics: raw!.topics.map(topic => topic.trim().toLowerCase()),
      };

      await deps.recordLookup(userId, {...input, text: match.text});
      const savedEntryId = await deps.findEntryId(userId, explanation.lemma, explanation.partOfSpeech);
      return {explanation, match, savedEntryId};
    },
  };
}
