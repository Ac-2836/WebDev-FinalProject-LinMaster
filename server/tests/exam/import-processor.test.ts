import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import type {PageLabels, ParseAnswersOutput, ParseTestOutput, Skill} from '@linmaster/shared';
import {getDb} from '../../src/core/db';
import type {Storage} from '../../src/core/storage';
import {createImportProcessor} from '../../src/modules/exam/import-processor';
import {type ImportJob, prismaImportRepository} from '../../src/modules/exam/imports.repository';
import {toCandidateTest} from '../../src/modules/exam/tests.service';
import {prismaTestRepository} from '../../src/modules/exam/tests.repository';
import {makeImportRepository} from './import-fakes';

const PDF = Buffer.from('%PDF-1.7 merged');
const range = (from: number, to: number) => Array.from({length: to - from + 1}, (_, index) => from + index);

/** parse-test.v1 output: 40 completion questions per skill; Listening has a transcript. */
function outline(skills: Skill[]): ParseTestOutput {
  return {
    title: 'Cambridge 18 Test 1',
    sections: skills.map(skill => ({
      skill,
      passages: [
        {
          title: skill === 'reading' ? 'Urban farming' : 'Part 1',
          paragraphs: [{label: skill === 'reading' ? 'A' : 'Woman', text: 'Farms grow on roofs.'}],
          groups: [
            {
              kind: 'completion',
              fromNo: 1,
              toNo: 40,
              instructions: 'Write ONE WORD ONLY.',
              wordLimit: 1,
              optionsTitle: null,
              options: null,
              content: null,
              questions: range(1, 40).map(number => ({number, prompt: `Gap {{blank}} ${number}`, options: null})),
            },
          ],
        },
      ],
    })),
  };
}

function answerKey(skills: Skill[], skip: number[] = []): ParseAnswersOutput {
  return {
    answers: skills.flatMap(skill =>
      range(1, 40)
        .filter(number => !skip.includes(number))
        .map(number => ({skill, number, answer: 'roofs', explanation: number === 1 ? 'Paragraph A.' : null})),
    ),
  };
}

const PAGES: PageLabels[] = [
  {page: 1, labels: ['passage', 'questions'], skill: 'reading', questionRange: {from: 1, to: 40}},
  {page: 2, labels: ['answers'], skill: 'reading', questionRange: {from: 1, to: 40}},
];

describe('import processor', () => {
  const storage: Storage = {
    put: () => Promise.reject(new Error('not used')),
    get: () => Promise.resolve(PDF),
    delete: () => Promise.resolve(),
  };
  const validating = vi.fn(() => Promise.resolve());

  async function setup(skills: Skill[], options: {pages?: PageLabels[]; skip?: number[]; audio?: boolean} = {}) {
    const state = makeImportRepository();
    const pdf = await state.repository.createFile('owner', {
      storageKey: 'merged.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF.length,
      originalName: 'test.pdf',
      durationSec: null,
    });
    const audio = options.audio
      ? await state.repository.createFile('owner', {
          storageKey: 'audio.mp3',
          mimeType: 'audio/mpeg',
          sizeBytes: 1,
          originalName: 'audio.mp3',
          durationSec: 1680,
        })
      : null;
    const parseTest = vi.fn(async () => outline(skills));
    const parseAnswers = vi.fn(async () => answerKey(skills, options.skip));
    const process = createImportProcessor({
      repository: state.repository,
      storage,
      labelPages: async () => options.pages ?? PAGES,
      parseTest,
      parseAnswers,
    });
    const job: ImportJob = {
      id: 'import',
      ownerId: 'owner',
      kind: skills.length === 2 ? 'full' : skills[0],
      questionFileId: pdf.id,
      answerFileId: pdf.id,
      audioFileId: audio?.id ?? null,
    };
    return {state, parseTest, parseAnswers, run: () => process(job, {validating})};
  }

  it('reads each task from its own pages, validates and saves a private test with warnings', async () => {
    const {state, parseTest, parseAnswers, run} = await setup(['reading']);

    const outcome = await run();

    expect(parseTest).toHaveBeenCalledWith(PDF, {pages: [1], userId: 'owner'});
    expect(parseAnswers).toHaveBeenCalledWith(PDF, {pages: [2], userId: 'owner'});
    expect(validating).toHaveBeenCalled();
    expect(outcome).toMatchObject({status: 'done', issues: [{severity: 'warning', code: 'EXPLANATION_MISSING'}]});
    const saved = state.savedTests.get((outcome as {testId: string}).testId)!;
    expect(saved).toMatchObject({ownerId: 'owner', certification: 'IELTS_ACADEMIC', audioFileId: null});
    expect(saved.test.sections[0].passages[0].groups[0].questions[0].answer).toEqual({
      accepted: ['roofs'],
      explanation: 'Paragraph A.',
    });
  });

  it('fails with the question numbers of missing answers, and saves nothing', async () => {
    const {state, run} = await setup(['reading'], {skip: [26, 27]});

    const outcome = await run();

    expect(outcome.status).toBe('failed');
    expect(outcome.issues.filter(issue => issue.severity === 'error')).toEqual([
      expect.objectContaining({code: 'ANSWER_MISSING', section: 'reading', questionNo: 26}),
      expect.objectContaining({code: 'ANSWER_MISSING', section: 'reading', questionNo: 27}),
    ]);
    expect(state.savedTests.size).toBe(0);
  });

  it('fails without answer pages, before calling the parse tasks', async () => {
    const {parseTest, run} = await setup(['reading'], {pages: [PAGES[0]]});

    const outcome = await run();

    expect(outcome).toMatchObject({status: 'failed', issues: [{code: 'PAGES_MISSING'}]});
    expect(parseTest).not.toHaveBeenCalled();
  });

  it('blocks Listening without audio and attaches the audio otherwise', async () => {
    const withoutAudio = await (await setup(['listening', 'reading'])).run();
    const {state, run} = await setup(['listening', 'reading'], {audio: true});
    const withAudio = await run();

    expect(withoutAudio.issues.map(issue => issue.code)).toContain('AUDIO_MISSING');
    expect(withAudio.status).toBe('done');
    const saved = state.savedTests.get((withAudio as {testId: string}).testId)!;
    expect(saved.test.sections.map(section => section.skill)).toEqual(['listening', 'reading']);
    expect(saved.audioFileId).not.toBeNull();
  });
});

describe('saving an imported test', () => {
  const db = getDb();
  const run = `save-${Date.now()}`;
  let ownerId = '';

  beforeAll(async () => {
    ownerId = (
      await db.user.create({data: {email: `import-${run}@linmaster.test`, passwordHash: 'x', displayName: 'owner'}})
    ).id;
  });

  afterAll(async () => {
    if (ownerId) await db.user.deleteMany({where: {id: ownerId}});
    await db.$disconnect();
  });

  it('stores a private test a candidate can take, answers kept out of the candidate view', async () => {
    const state = makeImportRepository();
    const pdf = await state.repository.createFile(ownerId, {
      storageKey: 'merged.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1,
      originalName: 'test.pdf',
      durationSec: null,
    });
    const process = createImportProcessor({
      // Real saving, everything else in memory.
      repository: {...state.repository, saveTest: prismaImportRepository.saveTest},
      storage: {put: () => Promise.reject(new Error('not used')), get: async () => PDF, delete: async () => {}},
      labelPages: async () => PAGES,
      parseTest: async () => outline(['reading']),
      parseAnswers: async () => answerKey(['reading']),
    });
    const job: ImportJob = {
      id: 'import',
      ownerId,
      kind: 'reading',
      questionFileId: pdf.id,
      answerFileId: pdf.id,
      audioFileId: null,
    };

    const outcome = await process(job, {validating: async () => {}});

    expect(outcome.status).toBe('done');
    const row = await prismaTestRepository.findTestContent((outcome as {testId: string}).testId);
    expect(row).toMatchObject({ownerId, visibility: 'private', kind: 'reading', title: 'Cambridge 18 Test 1'});
    const candidate = toCandidateTest(row!);
    expect(candidate).toMatchObject({questionCount: 40, durationSec: 3600, skills: ['reading']});
    expect(JSON.stringify(candidate)).not.toContain('Paragraph A.');
    expect(await db.question.count({where: {group: {passage: {section: {testId: candidate.id}}}}})).toBe(40);
  });
});
