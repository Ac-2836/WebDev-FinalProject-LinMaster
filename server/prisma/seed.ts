// Demo and mock data (Working_rules §9). Safe to run many times: the demo user is upserted and
// everything it owns is deleted and created again, so no row is duplicated.
import {existsSync} from 'node:fs';

import {PrismaPg} from '@prisma/adapter-pg';
import {hash} from 'bcryptjs';

import {PrismaClient} from '../src/generated/prisma/client';
import {seedSampleTests} from './seed-tests';

if (existsSync('.env')) process.loadEnvFile('.env');

/** Demo account shown in the README and the report; the demo data is public on purpose. */
const DEMO_EMAIL = 'demo@linmaster.app';
const DEMO_PASSWORD = 'LinMaster-demo-2026';
const HASH_ROUNDS = 12;
// Same scale as the reader and saved contexts: paragraphs joined by a blank line.
const PARAGRAPH_GAP = '\n\n';
const DAY_MS = 24 * 60 * 60 * 1000;

// Sample texts written by the team for the demo (not exam content).
const DOCUMENTS = [
  {
    title: 'Cities and the heat (sample text)',
    paragraphs: [
      'Rising global temperatures have prompted many cities to rethink their approach to urban planning.',
      'Planting trees along streets can mitigate the urban heat island effect, while green roofs help absorb rainwater and reduce the burden on drainage systems.',
      'However, critics argue that such measures are merely cosmetic unless governments also curb emissions from transport and industry.',
    ],
  },
  {
    title: 'Learning online (sample text)',
    paragraphs: [
      'Online courses have made education more accessible to people who cannot attend classes in person.',
      'Yet many learners struggle to stay motivated without the routine of a classroom, and dropout rates remain stubbornly high.',
      'Teachers who give frequent feedback tend to keep their students engaged for longer.',
    ],
  },
];

interface DemoWord {
  document: number;
  headword: string;
  lemma: string;
  partOfSpeech: string;
  ipa: string;
  meaningVi: string;
  definitionEn: string;
  cefr: 'B1' | 'B2' | 'C1';
  topics: string[];
  collocations: string[];
}

const WORDS: DemoWord[] = [
  {
    document: 0,
    headword: 'prompted',
    lemma: 'prompt',
    partOfSpeech: 'verb',
    ipa: '/prɒmpt/',
    meaningVi: 'thúc đẩy, khiến cho',
    definitionEn: 'to cause someone to do something',
    cefr: 'B2',
    topics: ['environment'],
    collocations: ['prompt a change'],
  },
  {
    document: 0,
    headword: 'mitigate',
    lemma: 'mitigate',
    partOfSpeech: 'verb',
    ipa: '/ˈmɪtɪɡeɪt/',
    meaningVi: 'giảm nhẹ',
    definitionEn: 'to make something less harmful or serious',
    cefr: 'C1',
    topics: ['environment'],
    collocations: ['mitigate the effect', 'mitigate the risk'],
  },
  {
    document: 0,
    headword: 'absorb',
    lemma: 'absorb',
    partOfSpeech: 'verb',
    ipa: '/əbˈzɔːb/',
    meaningVi: 'hấp thụ',
    definitionEn: 'to take in a liquid or gas',
    cefr: 'B2',
    topics: ['environment', 'science'],
    collocations: ['absorb water', 'absorb heat'],
  },
  {
    document: 0,
    headword: 'burden',
    lemma: 'burden',
    partOfSpeech: 'noun',
    ipa: '/ˈbɜːdn/',
    meaningVi: 'gánh nặng',
    definitionEn: 'a heavy load or duty',
    cefr: 'B2',
    topics: ['society'],
    collocations: ['reduce the burden', 'a financial burden'],
  },
  {
    document: 0,
    headword: 'cosmetic',
    lemma: 'cosmetic',
    partOfSpeech: 'adjective',
    ipa: '/kɒzˈmetɪk/',
    meaningVi: 'mang tính hình thức',
    definitionEn: 'changing only the surface, not the real problem',
    cefr: 'C1',
    topics: ['government'],
    collocations: ['cosmetic changes'],
  },
  {
    document: 0,
    headword: 'curb',
    lemma: 'curb',
    partOfSpeech: 'verb',
    ipa: '/kɜːb/',
    meaningVi: 'kiềm chế, hạn chế',
    definitionEn: 'to control or limit something harmful',
    cefr: 'C1',
    topics: ['environment', 'government'],
    collocations: ['curb emissions', 'curb spending'],
  },
  {
    document: 1,
    headword: 'accessible',
    lemma: 'accessible',
    partOfSpeech: 'adjective',
    ipa: '/əkˈsesəbl/',
    meaningVi: 'dễ tiếp cận',
    definitionEn: 'easy to reach, get or use',
    cefr: 'B2',
    topics: ['education', 'technology'],
    collocations: ['easily accessible', 'accessible to everyone'],
  },
  {
    document: 1,
    headword: 'motivated',
    lemma: 'motivated',
    partOfSpeech: 'adjective',
    ipa: '/ˈməʊtɪveɪtɪd/',
    meaningVi: 'có động lực',
    definitionEn: 'wanting to do something well',
    cefr: 'B1',
    topics: ['education'],
    collocations: ['stay motivated', 'highly motivated'],
  },
  {
    document: 1,
    headword: 'stubbornly',
    lemma: 'stubbornly',
    partOfSpeech: 'adverb',
    ipa: '/ˈstʌbənli/',
    meaningVi: 'một cách dai dẳng',
    definitionEn: 'in a way that is difficult to change',
    cefr: 'C1',
    topics: ['education'],
    collocations: ['stubbornly high'],
  },
  {
    document: 1,
    headword: 'engaged',
    lemma: 'engaged',
    partOfSpeech: 'adjective',
    ipa: '/ɪnˈɡeɪdʒd/',
    meaningVi: 'chú tâm, gắn bó',
    definitionEn: 'interested and taking part',
    cefr: 'B2',
    topics: ['education'],
    collocations: ['keep students engaged'],
  },
];

/** Sentence of the paragraph that contains `headword`, and the headword's offsets in the whole document text. */
function locate(paragraphs: string[], headword: string) {
  let paragraphStart = 0;
  for (const paragraph of paragraphs) {
    const index = paragraph.indexOf(headword);
    if (index >= 0) {
      // Every sample paragraph is one sentence, so the sentence is the paragraph.
      return {
        sentence: paragraph,
        startOffset: paragraphStart + index,
        endOffset: paragraphStart + index + headword.length,
      };
    }
    paragraphStart += paragraph.length + PARAGRAPH_GAP.length;
  }
  throw new Error(`Seed word "${headword}" is not in its document.`);
}

async function seedDemo(db: PrismaClient): Promise<string> {
  const passwordHash = await hash(DEMO_PASSWORD, HASH_ROUNDS);
  const user = await db.user.upsert({
    where: {email: DEMO_EMAIL},
    create: {email: DEMO_EMAIL, passwordHash, displayName: 'Demo Learner', targetBand: 7},
    update: {passwordHash, displayName: 'Demo Learner', targetBand: 7},
  });
  const userId = user.id;

  // Rebuild the demo user's content from scratch; cascades remove cards, contexts and progress.
  await db.$transaction([
    db.flashcardSet.deleteMany({where: {ownerId: userId}}),
    db.vocabEntry.deleteMany({where: {ownerId: userId}}),
    db.vocabLookup.deleteMany({where: {ownerId: userId}}),
    db.document.deleteMany({where: {ownerId: userId}}),
  ]);

  const documents = [];
  for (const {title, paragraphs} of DOCUMENTS) {
    const wordCount = paragraphs.join(' ').split(/\s+/u).length;
    documents.push(
      await db.document.create({
        data: {ownerId: userId, title, source: 'paste', paragraphs: paragraphs.map(text => ({text})), wordCount},
      }),
    );
  }

  const entries = [];
  for (const {document, headword, ...word} of WORDS) {
    const context = locate(DOCUMENTS[document].paragraphs, headword);
    entries.push(
      await db.vocabEntry.create({
        data: {
          ownerId: userId,
          headword,
          ...word,
          contexts: {create: {documentId: documents[document].id, ...context}},
        },
      }),
    );
  }

  const fromBank = await db.flashcardSet.create({
    data: {
      ownerId: userId,
      title: 'Cities and the heat',
      description: 'Created from the word bank of "Cities and the heat".',
      cards: {
        create: entries
          .filter((_, index) => WORDS[index].document === 0)
          .map((entry, position) => ({
            position,
            term: entry.lemma,
            definition: entry.meaningVi,
            vocabEntryId: entry.id,
          })),
      },
    },
    include: {cards: {orderBy: {position: 'asc'}}},
  });
  await db.flashcardSet.create({
    data: {
      ownerId: userId,
      title: 'Study habits',
      description: 'A set typed by hand, without the word bank.',
      cards: {
        create: [
          {position: 0, term: 'revise', definition: 'ôn tập', example: 'I revise my notes every evening.'},
          {position: 1, term: 'deadline', definition: 'hạn chót', example: 'The essay deadline is on Friday.'},
          {
            position: 2,
            term: 'procrastinate',
            definition: 'trì hoãn',
            example: 'Try not to procrastinate before exams.',
          },
        ],
      },
    },
  });

  // Progress values only (no SM-2 logic here): one card per state of st-04 plus two due today.
  const now = Date.now();
  const progress = [
    {easiness: 2.6, intervalDays: 21, repetitions: 5, lapses: 0, due: 14, reviewed: -7}, // mastered
    {easiness: 2.36, intervalDays: 6, repetitions: 2, lapses: 1, due: 3, reviewed: -3}, // learning
    {easiness: 2.5, intervalDays: 1, repetitions: 1, lapses: 0, due: 0, reviewed: -1}, // learning, due today
    {easiness: 2.18, intervalDays: 1, repetitions: 0, lapses: 2, due: -1, reviewed: -2}, // overdue
  ];
  // Remaining cards of the set have no progress row: they count as new.
  await db.cardProgress.createMany({
    data: progress.map(({due, reviewed, ...state}, index) => ({
      userId,
      cardId: fromBank.cards[index].id,
      ...state,
      dueAt: new Date(now + due * DAY_MS),
      lastReviewedAt: new Date(now + reviewed * DAY_MS),
    })),
  });

  console.log(
    `Seed: demo user ${DEMO_EMAIL} with ${documents.length} documents, ${entries.length} words, 2 sets, ${progress.length} progress rows.`,
  );
  return userId;
}

async function main() {
  const db = new PrismaClient({adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})});
  try {
    await seedSampleTests(db, await seedDemo(db));
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
