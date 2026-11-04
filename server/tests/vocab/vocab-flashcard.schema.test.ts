import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {getDb} from '../../src/core/db';

// Schema check against the test database: unique keys and the delete rules of the data dictionary.
const email = `vocab-schema-${Date.now()}@linmaster.test`;

describe('vocab and flashcard tables', () => {
  const db = getDb();
  let userId: string;

  beforeAll(async () => {
    userId = (await db.user.create({data: {email, passwordHash: 'x', displayName: 'Vocab Schema'}})).id;
  });
  afterAll(async () => {
    await db.user.deleteMany({where: {email}});
    await db.$disconnect();
  });

  const entry = (lemma: string) => ({
    ownerId: userId,
    headword: lemma,
    lemma,
    partOfSpeech: 'verb',
    meaningVi: 'nghĩa mẫu',
  });

  it('allows one VocabEntry per (owner, lemma, partOfSpeech)', async () => {
    await db.vocabEntry.create({data: entry('mitigate')});
    await expect(db.vocabEntry.create({data: entry('mitigate')})).rejects.toMatchObject({code: 'P2002'});
  });

  it('keeps the saved sentence when its document is deleted', async () => {
    const doc = await db.document.create({
      data: {ownerId: userId, title: 'Doc', source: 'paste', paragraphs: [{text: 'One sentence.'}], wordCount: 2},
    });
    const saved = await db.vocabEntry.create({
      data: {...entry('sentence'), contexts: {create: {sentence: 'One sentence.', documentId: doc.id}}},
      include: {contexts: true},
    });
    await db.document.delete({where: {id: doc.id}});
    const context = await db.vocabContext.findUniqueOrThrow({where: {id: saved.contexts[0].id}});
    expect(context.documentId).toBeNull();
  });

  it('keeps a card when its word is deleted, and deletes cards and progress with the set', async () => {
    const word = await db.vocabEntry.create({data: entry('resilient')});
    const set = await db.flashcardSet.create({
      data: {
        ownerId: userId,
        title: 'Set',
        cards: {create: {position: 1, term: 'resilient', definition: 'kiên cường', vocabEntryId: word.id}},
      },
      include: {cards: true},
    });
    const cardId = set.cards[0].id;
    await db.cardProgress.create({data: {userId, cardId, dueAt: new Date()}});
    await expect(db.cardProgress.create({data: {userId, cardId, dueAt: new Date()}})).rejects.toMatchObject({
      code: 'P2002',
    });

    await db.vocabEntry.delete({where: {id: word.id}});
    expect((await db.card.findUniqueOrThrow({where: {id: cardId}})).vocabEntryId).toBeNull();

    await db.flashcardSet.delete({where: {id: set.id}});
    expect(await db.card.count({where: {id: cardId}})).toBe(0);
    expect(await db.cardProgress.count({where: {cardId}})).toBe(0);
  });

  it('keeps review history when the study session is deleted', async () => {
    const set = await db.flashcardSet.create({
      data: {ownerId: userId, title: 'Set 2', cards: {create: {position: 1, term: 't', definition: 'd'}}},
      include: {cards: true},
    });
    const session = await db.studySession.create({data: {userId, setId: set.id, mode: 'learn'}});
    const log = await db.reviewLog.create({
      data: {
        userId,
        cardId: set.cards[0].id,
        sessionId: session.id,
        rating: 'good',
        intervalBefore: 0,
        intervalAfter: 1,
      },
    });
    await db.studySession.delete({where: {id: session.id}});
    expect((await db.reviewLog.findUniqueOrThrow({where: {id: log.id}})).sessionId).toBeNull();
  });
});
