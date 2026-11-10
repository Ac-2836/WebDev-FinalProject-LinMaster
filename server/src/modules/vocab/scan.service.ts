import {
  type CefrLevelSchema,
  MAX_SCAN_CANDIDATES,
  type ScanCandidate,
  type ScanDocumentOutput,
  type ScanDocumentRequest,
} from '@linmaster/shared';
import type {z} from 'zod';

import {runJsonTask} from '../../core/ai/ai-gateway';
import {AppError} from '../../core/app-error';
import {type ScanDocumentInput, scanDocumentTask} from './ai/scan-document.v1';
import {prismaVocabDocumentRepository} from './documents.repository';

// Same scale as the reader (client/features/vocab/reader-text.ts) and saved contexts.
const PARAGRAPH_GAP = '\n\n';

export interface ScanDeps {
  scan(input: ScanDocumentInput, userId: string): Promise<ScanDocumentOutput>;
  getParagraphs(userId: string, documentId: string): Promise<Array<{text: string}> | null>;
}

export const prismaScanDeps: ScanDeps = {
  scan: (input, userId) => runJsonTask(scanDocumentTask, input, {userId}),
  async getParagraphs(userId, documentId) {
    return (await prismaVocabDocumentRepository.getDocumentForUser(userId, documentId))?.paragraphs ?? null;
  },
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Keeps only candidates whose sentence is really in the document and contains the headword,
 * then adds the headword's offsets. Drops levels outside the filter and repeated lemmas.
 */
export function verifyCandidates(
  text: string,
  candidates: ScanDocumentOutput['candidates'],
  levels?: Array<z.infer<typeof CefrLevelSchema>>,
): ScanCandidate[] {
  const seen = new Set<string>();
  const result: ScanCandidate[] = [];
  for (const candidate of candidates) {
    if (result.length === MAX_SCAN_CANDIDATES) break;
    const sentence = candidate.sentence.trim();
    const sentenceStart = sentence ? text.indexOf(sentence) : -1;
    if (sentenceStart < 0) continue; // invented or rewritten sentence

    const match = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(candidate.headword.trim())}(?![\\p{L}\\p{N}])`,
      'iu',
    ).exec(sentence);
    if (!match) continue;
    if (levels && !levels.includes(candidate.cefr)) continue;

    const lemma = candidate.lemma.trim().toLowerCase();
    const partOfSpeech = candidate.partOfSpeech.trim().toLowerCase();
    const key = `${lemma}|${partOfSpeech}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const startOffset = sentenceStart + match.index;
    result.push({
      ...candidate,
      headword: match[0],
      lemma,
      partOfSpeech,
      topics: candidate.topics.map(topic => topic.trim().toLowerCase()),
      sentence,
      startOffset,
      endOffset: startOffset + match[0].length,
    });
  }
  return result;
}

/** POST /vocab/documents/:id/scan: quick filter through `scan-document.v1` (seq-03-loc-nhanh). */
export function createScanService(deps: ScanDeps = prismaScanDeps) {
  return {
    async scan(userId: string, documentId: string, filters: ScanDocumentRequest) {
      const paragraphs = await deps.getParagraphs(userId, documentId);
      if (!paragraphs) throw new AppError('Document not found.', 404);

      const text = paragraphs.map(paragraph => paragraph.text).join(PARAGRAPH_GAP);
      const output = await deps.scan({text, ...filters}, userId);
      return {candidates: verifyCandidates(text, output.candidates, filters.levels)};
    },
  };
}
