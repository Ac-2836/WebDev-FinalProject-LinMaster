import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {ListVocabEntriesQuery, SaveVocabEntry} from '@linmaster/shared';
import {getDb} from '../../src/core/db';
import {prismaVocabRepository, VocabDocumentNotFoundError} from '../../src/modules/vocab/vocab.repository';

const testRun = `${Date.now()}`;
const ownerEmail = `vocab-repository-${testRun}@linmaster.test`;
const otherEmail = `vocab-repository-other-${testRun}@linmaster.test`;

describe('Prisma vocab repository', () => {
  const db = getDb();
  let ownerId: string;
  let otherUserId: string;

  beforeAll(async () => {
    ownerId = (await db.user.create({data: {email: ownerEmail, passwordHash: 'x', displayName: 'Vocab owner'}})).id;
    otherUserId = (await db.user.create({data: {email: otherEmail, passwordHash: 'x', displayName: 'Other owner'}})).id;
  });

  afterAll(async () => {
    const userIds = [ownerId, otherUserId].filter((id): id is string => id !== undefined);
    if (userIds.length > 0) await db.user.deleteMany({where: {id: {in: userIds}}});
    await db.$disconnect();
  });

  it('merges a duplicate by adding contexts and preserves the original entry details', async () => {
    const first = await prismaVocabRepository.saveEntries(ownerId, [
      {
        headword: 'mitigated',
        lemma: `mitigate-${testRun}`,
        partOfSpeech: 'verb',
        meaningVi: 'giảm nhẹ',
        cefr: 'C1',
        topics: ['environment'],
        collocations: ['mitigate the impact'],
        context: {sentence: 'Policy A mitigated the impact.'},
      },
    ]);
    const duplicate = await prismaVocabRepository.saveEntries(ownerId, [
      {
        headword: 'mitigates',
        lemma: `mitigate-${testRun}`,
        partOfSpeech: 'verb',
        meaningVi: 'làm dịu',
        context: {sentence: 'Policy B mitigates the impact.'},
      },
    ]);

    expect(duplicate).toHaveLength(1);
    expect(duplicate[0].id).toBe(first[0].id);
    expect(duplicate[0]).toMatchObject({
      headword: 'mitigated',
      meaningVi: 'giảm nhẹ',
      cefr: 'C1',
      topics: ['environment'],
      collocations: ['mitigate the impact'],
    });
    expect(duplicate[0].contexts.map(context => context.sentence)).toEqual([
      'Policy A mitigated the impact.',
      'Policy B mitigates the impact.',
    ]);
    expect(duplicate[0]).not.toHaveProperty('ownerId');
    expect(await db.vocabEntry.count({where: {ownerId, lemma: `mitigate-${testRun}`}})).toBe(1);
  });

  it('rolls back a save batch when one context belongs to another user', async () => {
    const foreignDocument = await db.document.create({
      data: {
        ownerId: otherUserId,
        title: 'Foreign document',
        source: 'paste',
        paragraphs: [{text: 'Private text.'}],
        wordCount: 2,
      },
    });
    const lemma = `partial-${testRun}`;
    const validEntry: SaveVocabEntry = {
      headword: lemma,
      lemma,
      partOfSpeech: 'noun',
      meaningVi: 'partial entry',
    };
    const invalidEntry: SaveVocabEntry = {
      headword: 'private',
      lemma: `private-${testRun}`,
      partOfSpeech: 'noun',
      meaningVi: 'private entry',
      context: {sentence: 'Private text.', documentId: foreignDocument.id},
    };

    await expect(prismaVocabRepository.saveEntries(ownerId, [validEntry, invalidEntry])).rejects.toBeInstanceOf(
      VocabDocumentNotFoundError,
    );
    expect(await db.vocabEntry.count({where: {ownerId, lemma}})).toBe(0);
  });

  it('filters by topic and document and returns the unpaginated total', async () => {
    const documentA = await db.document.create({
      data: {ownerId, title: 'A', source: 'paste', paragraphs: [{text: 'A'}], wordCount: 1},
    });
    const documentB = await db.document.create({
      data: {ownerId, title: 'B', source: 'paste', paragraphs: [{text: 'B'}], wordCount: 1},
    });
    await prismaVocabRepository.saveEntries(ownerId, [
      {
        headword: 'recycle',
        lemma: `recycle-${testRun}`,
        partOfSpeech: 'verb',
        meaningVi: 'tái chế',
        topics: ['environment'],
        context: {sentence: 'Recycle A.', documentId: documentA.id},
      },
      {
        headword: 'sustain',
        lemma: `sustain-${testRun}`,
        partOfSpeech: 'verb',
        meaningVi: 'duy trì',
        topics: ['environment'],
        context: {sentence: 'Sustain A.', documentId: documentA.id},
      },
      {
        headword: 'exercise',
        lemma: `exercise-${testRun}`,
        partOfSpeech: 'verb',
        meaningVi: 'tập thể dục',
        topics: ['health'],
        context: {sentence: 'Exercise B.', documentId: documentB.id},
      },
    ]);
    const query: ListVocabEntriesQuery = {
      q: undefined,
      topic: 'environment',
      cefr: undefined,
      documentId: documentA.id,
      page: 1,
      pageSize: 1,
    };

    const page = await prismaVocabRepository.listEntries(ownerId, query);

    expect(page.entries).toHaveLength(1);
    expect(page.total).toBe(2);
    expect(page.entries[0]).not.toHaveProperty('ownerId');
  });
});
