import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {getDb} from '../../src/core/db';

// Schema check against the test database: the test tree, the one-in-progress-attempt rule and delete rules.
const email = `exam-schema-${Date.now()}@linmaster.test`;

describe('exam tables', () => {
  const db = getDb();
  let userId: string;

  beforeAll(async () => {
    userId = (await db.user.create({data: {email, passwordHash: 'x', displayName: 'Exam Schema'}})).id;
  });
  afterAll(async () => {
    await db.test.deleteMany({where: {ownerId: userId}});
    await db.testImport.deleteMany({where: {ownerId: userId}});
    await db.storedFile.deleteMany({where: {ownerId: userId}});
    await db.user.deleteMany({where: {email}});
    await db.$disconnect();
  });

  // Sample structure only (no real exam content): one section → passage → group → question.
  const createTest = () =>
    db.test.create({
      data: {
        ownerId: userId,
        certification: 'IELTS_ACADEMIC',
        kind: 'reading',
        title: 'Schema test (sample data)',
        sections: {
          create: {
            skill: 'reading',
            position: 1,
            durationSec: 3600,
            passages: {
              create: {
                position: 1,
                title: 'Sample passage',
                paragraphs: [{label: 'A', text: 'Sample text.'}],
                groups: {
                  create: {
                    position: 1,
                    kind: 'tfng',
                    fromNo: 1,
                    toNo: 1,
                    instructions: 'Sample instructions.',
                    questions: {create: {number: 1, prompt: 'Sample prompt.', answer: {accepted: ['TRUE']}}},
                  },
                },
              },
            },
          },
        },
      },
    });

  const startAttempt = (testId: string) =>
    db.attempt.create({data: {userId, testId, deadlineAt: new Date(Date.now() + 3_600_000), state: {}}});

  it('allows only one in_progress attempt per learner and test', async () => {
    const test = await createTest();
    const first = await startAttempt(test.id);
    await expect(startAttempt(test.id)).rejects.toMatchObject({code: 'P2002'});

    await db.attempt.update({where: {id: first.id}, data: {status: 'submitted', submittedAt: new Date()}});
    await expect(startAttempt(test.id)).resolves.toMatchObject({status: 'in_progress'});
  });

  it('keeps graded answers when a question is deleted, and deletes the whole tree with the test', async () => {
    const test = await createTest();
    const question = await db.question.findFirstOrThrow({where: {group: {passage: {section: {testId: test.id}}}}});
    const attempt = await startAttempt(test.id);
    const answer = await db.attemptAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: question.id,
        questionNumber: 1,
        skill: 'reading',
        kind: 'tfng',
        correctAnswer: {accepted: ['TRUE']},
        isCorrect: false,
      },
    });

    await db.question.delete({where: {id: question.id}});
    expect((await db.attemptAnswer.findUniqueOrThrow({where: {id: answer.id}})).questionId).toBeNull();

    await db.test.delete({where: {id: test.id}});
    expect(await db.testSection.count({where: {testId: test.id}})).toBe(0);
    expect(await db.attempt.count({where: {testId: test.id}})).toBe(0);
  });

  it('keeps an import when its test is deleted and protects files in use', async () => {
    const file = (name: string) =>
      db.storedFile.create({
        data: {
          ownerId: userId,
          storageKey: `tests/${email}/${name}`,
          mimeType: 'application/pdf',
          sizeBytes: 1,
          originalName: name,
        },
      });
    const questionFile = await file('de.pdf');
    const answerFile = await file('dap-an.pdf');
    const test = await createTest();
    const upload = await db.testImport.create({
      data: {
        ownerId: userId,
        kind: 'reading',
        status: 'done',
        questionFileId: questionFile.id,
        answerFileId: answerFile.id,
        testId: test.id,
      },
    });

    await expect(db.storedFile.delete({where: {id: questionFile.id}})).rejects.toMatchObject({code: 'P2003'});

    await db.test.delete({where: {id: test.id}});
    expect((await db.testImport.findUniqueOrThrow({where: {id: upload.id}})).testId).toBeNull();
  });
});
