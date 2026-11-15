// Six weeks of demo activity (dashboard) and sample community content (library), P4-05.
// Rows follow the database schema only; no library or stats logic is reused or rewritten here.
import {randomBytes} from 'node:crypto';

import {CERTIFICATIONS, type Skill, toBand} from '@linmaster/shared';
import {hash} from 'bcryptjs';

import {Prisma, type PrismaClient, type Rating} from '../src/generated/prisma/client';
import {seedSampleTests} from './seed-tests';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
// Vietnam time is UTC+7 all year; dashboard days are Vietnam days.
const VIETNAM_OFFSET_MS = 7 * HOUR_MS;
const HISTORY_DAYS = 42;
const CERTIFICATION = CERTIFICATIONS.IELTS_ACADEMIC;
/** Sample authors of public content; they cannot sign in (random password nobody knows). */
const AUTHORS = [
  {email: 'sample.lan@linmaster.app', displayName: 'Lan (sample)'},
  {email: 'sample.minh@linmaster.app', displayName: 'Minh (sample)'},
];
const RATINGS: Rating[] = ['good', 'good', 'easy', 'hard', 'good', 'again'];

/** Same numbers on every run, so the demo looks the same after each seed. */
function random(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
}

/** `daysAgo` days before today (Vietnam), at `hour` o'clock Vietnam time. */
function vietnamTime(daysAgo: number, hour: number): Date {
  const todayStart = Math.floor((Date.now() + VIETNAM_OFFSET_MS) / DAY_MS) * DAY_MS - VIETNAM_OFFSET_MS;
  return new Date(todayStart - daysAgo * DAY_MS + hour * HOUR_MS);
}

/** Lookups, saved words, reviews and study sessions spread over the last 6 weeks (no activity today yet). */
async function seedActivity(db: PrismaClient, userId: string) {
  const next = random(68);
  const entries = await db.vocabEntry.findMany({
    where: {ownerId: userId},
    orderBy: {createdAt: 'asc'},
    include: {contexts: {take: 1}},
  });
  const cards = await db.card.findMany({where: {set: {ownerId: userId}}, select: {id: true, setId: true}});

  // Words were saved one by one over the six weeks, oldest first.
  for (const [index, entry] of entries.entries()) {
    const savedAt = vietnamTime(HISTORY_DAYS - 2 - index * 4, 20);
    await db.vocabEntry.update({where: {id: entry.id}, data: {createdAt: savedAt}});
    await db.vocabContext.updateMany({where: {entryId: entry.id}, data: {createdAt: savedAt}});
  }

  const lookups = [];
  const reviews = [];
  let sessions = 0;
  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 1; daysAgo--) {
    // About five days a week, and every day of the last week (current streak).
    if (daysAgo > 7 && next() < 0.3) continue;
    const entry = entries[Math.floor(next() * entries.length)];
    for (let i = 0; i < 1 + Math.floor(next() * 4); i++) {
      lookups.push({
        ownerId: userId,
        documentId: entry.contexts[0]?.documentId ?? null,
        text: entry.headword,
        sentence: entry.contexts[0]?.sentence ?? entry.headword,
        saved: next() < 0.4,
        createdAt: vietnamTime(daysAgo, 19 + i * 0.1),
      });
    }
    if (next() < 0.6 && cards.length > 0) {
      const startedAt = vietnamTime(daysAgo, 21);
      const studied = cards.slice(0, 3 + Math.floor(next() * (cards.length - 2)));
      const session = await db.studySession.create({
        data: {
          userId,
          setId: studied[0].setId,
          mode: next() < 0.5 ? 'flip' : 'learn',
          startedAt,
          endedAt: new Date(startedAt.getTime() + (8 + Math.floor(next() * 15)) * 60_000),
          cardsStudied: studied.length,
          correctCount: Math.floor(studied.length * 0.7),
        },
      });
      sessions++;
      for (const [i, card] of studied.entries()) {
        reviews.push({
          userId,
          cardId: card.id,
          sessionId: card.setId === session.setId ? session.id : null,
          rating: RATINGS[Math.floor(next() * RATINGS.length)],
          intervalBefore: i % 4,
          intervalAfter: (i % 4) + 1,
          reviewedAt: new Date(startedAt.getTime() + i * 30_000),
        });
      }
    }
  }
  await db.vocabLookup.createMany({data: lookups});
  await db.reviewLog.createMany({data: reviews});
  return {lookups: lookups.length, reviews: reviews.length, sessions};
}

/**
 * A submitted attempt with `correct` right answers. Answers are graded rows only (snapshot of the key);
 * the wrong ones go to `weakKinds` first so the weak-points widget shows a clear weakest kind.
 */
async function submitAttempt(
  db: PrismaClient,
  userId: string,
  testId: string,
  skill: Skill,
  correct: number,
  submittedAt: Date,
  weakKinds: string[] = [],
) {
  const questions = await db.question.findMany({
    where: {group: {passage: {section: {testId, skill}}}},
    select: {id: true, number: true, answer: true, group: {select: {kind: true}}},
    orderBy: {number: 'asc'},
  });
  const weakFirst = [...questions].sort(
    (a, b) => Number(weakKinds.includes(b.group.kind)) - Number(weakKinds.includes(a.group.kind)),
  );
  const wrong = new Set(weakFirst.slice(0, questions.length - correct).map(question => question.id));
  const durationSec = CERTIFICATION.sections[skill].durationSec;
  const startedAt = new Date(submittedAt.getTime() - (durationSec - 300) * 1000);
  const band = toBand(CERTIFICATION, skill, correct);
  return db.attempt.create({
    data: {
      userId,
      testId,
      status: 'submitted',
      startedAt,
      deadlineAt: new Date(startedAt.getTime() + durationSec * 1000),
      submittedAt,
      state: {answers: {}, highlights: [], notes: [], flags: [], position: null},
      ...(skill === 'listening'
        ? {listeningCorrect: correct, listeningBand: band}
        : {readingCorrect: correct, readingBand: band}),
      answers: {
        create: questions.map(question => {
          const answer = question.answer as {value?: string; accepted?: string[]; choices?: string[]};
          const right = answer.value ?? answer.accepted?.[0] ?? answer.choices?.join(', ') ?? null;
          return {
            questionId: question.id,
            questionNumber: question.number,
            skill,
            kind: question.group.kind,
            given: wrong.has(question.id) || right === null ? Prisma.JsonNull : right,
            correctAnswer: question.answer ?? {},
            isCorrect: !wrong.has(question.id),
          };
        }),
      },
    },
  });
}

/** Six submitted attempts on the demo's sample tests, bands rising week by week. */
async function seedAttempts(db: PrismaClient, userId: string) {
  const tests = await db.test.findMany({where: {ownerId: userId}, select: {id: true, kind: true}});
  const testOf = (skill: Skill) => tests.find(test => test.kind === skill)!.id;
  const plan: Array<[Skill, number, number]> = [
    ['reading', 38, 21], // [skill, days ago, correct answers]
    ['listening', 31, 20],
    ['reading', 24, 25],
    ['listening', 17, 26],
    ['reading', 10, 29],
    ['listening', 3, 31],
  ];
  for (const [skill, daysAgo, correct] of plan) {
    await submitAttempt(db, userId, testOf(skill), skill, correct, vietnamTime(daysAgo, 10), ['matching', 'tfng']);
  }
  return plan.length;
}

/**
 * Sample authors with public sets and a public test, and the demo's own published content used by them:
 * copies of the demo's public set (copyCount) and attempts at the demo's public Reading test (attemptCount).
 */
async function seedCommunity(db: PrismaClient, demoId: string) {
  const passwordHash = await hash(randomBytes(24).toString('base64'), 4);
  const authors = [];
  for (const author of AUTHORS) {
    const user = await db.user.upsert({
      where: {email: author.email},
      create: {...author, passwordHash},
      update: {displayName: author.displayName, passwordHash},
    });
    // Their attempts first (also on the demo's test), then their sets; their tests are rebuilt by seedSampleTests.
    await db.attempt.deleteMany({where: {userId: user.id}});
    await db.flashcardSet.deleteMany({where: {ownerId: user.id}});
    authors.push(user.id);
  }

  const publishedAt = vietnamTime(20, 9);
  const SETS = [
    {
      title: 'IELTS Reading: environment words',
      cards: [
        ['biodiversity', 'đa dạng sinh học'],
        ['emission', 'khí thải'],
        ['sustainable', 'bền vững'],
        ['habitat', 'môi trường sống'],
      ],
    },
    {
      title: 'Listening Part 1: forms and numbers',
      cards: [
        ['postcode', 'mã bưu chính'],
        ['surname', 'họ'],
        ['deposit', 'tiền đặt cọc'],
      ],
    },
    {
      title: 'Academic verbs',
      cards: [
        ['analyse', 'phân tích'],
        ['assess', 'đánh giá'],
        ['illustrate', 'minh họa'],
      ],
    },
  ];
  for (const [index, set] of SETS.entries()) {
    await db.flashcardSet.create({
      data: {
        ownerId: authors[index % authors.length],
        title: set.title,
        visibility: 'public',
        publishedAt: new Date(publishedAt.getTime() + index * DAY_MS),
        copyCount: index + 1,
        cards: {create: set.cards.map(([term, definition], position) => ({position, term, definition}))},
      },
    });
  }

  // One public sample test from the first author (its own copy of the sample Listening test).
  await seedSampleTests(db, authors[0]);
  await db.test.updateMany({
    where: {ownerId: authors[0], kind: 'listening'},
    data: {visibility: 'public', publishedAt, attemptCount: 3},
  });
  await db.test.deleteMany({where: {ownerId: authors[0], kind: 'reading'}});

  // The demo publishes its word-bank set and its Reading test; each author copies the set and takes the test.
  const demoSet = await db.flashcardSet.findFirstOrThrow({
    where: {ownerId: demoId, cards: {some: {vocabEntryId: {not: null}}}},
    include: {cards: {orderBy: {position: 'asc'}}},
  });
  const demoTest = await db.test.findFirstOrThrow({where: {ownerId: demoId, kind: 'reading'}});
  for (const [index, authorId] of authors.entries()) {
    await db.flashcardSet.create({
      data: {
        ownerId: authorId,
        title: demoSet.title,
        description: demoSet.description,
        copiedFromId: demoSet.id,
        cards: {
          create: demoSet.cards.map(({position, term, definition, example}) => ({position, term, definition, example})),
        },
      },
    });
    await submitAttempt(db, authorId, demoTest.id, 'reading', 24 + index * 5, vietnamTime(5 - index, 15));
  }
  await db.flashcardSet.update({
    where: {id: demoSet.id},
    data: {visibility: 'public', publishedAt: vietnamTime(12, 9), copyCount: authors.length},
  });
  await db.test.update({
    where: {id: demoTest.id},
    data: {visibility: 'public', publishedAt: vietnamTime(8, 9), attemptCount: authors.length},
  });
  return {authors: authors.length, sets: SETS.length};
}

/** Demo history and community content; run after the demo user and its sample tests were seeded. */
export async function seedHistory(db: PrismaClient, demoId: string) {
  const activity = await seedActivity(db, demoId);
  const attempts = await seedAttempts(db, demoId);
  const community = await seedCommunity(db, demoId);
  console.log(
    `Seed: 6 weeks of demo history (${activity.lookups} lookups, ${activity.reviews} reviews, ` +
      `${activity.sessions} study sessions, ${attempts} attempts); ${community.authors} sample authors with ` +
      `${community.sets} public sets and 1 public test.`,
  );
}
