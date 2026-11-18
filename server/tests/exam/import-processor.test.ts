import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import type {PageLabels, ParseAnswersOutput, ParseTestOutput, Skill} from '@linmaster/shared';
import {getDb} from '../../src/core/db';
import {AppError} from '../../src/core/app-error';
import type {Storage} from '../../src/core/storage';
import {createImportProcessor} from '../../src/modules/exam/import-processor';
import {type ImportJob, prismaImportRepository} from '../../src/modules/exam/imports.repository';
import {toCandidateTest} from '../../src/modules/exam/tests.service';
import {prismaTestRepository} from '../../src/modules/exam/tests.repository';
import {makeImportRepository} from './import-fakes';

type ParseAudio = NonNullable<Parameters<typeof createImportProcessor>[0]['parseAudio']>;

const PDF = Buffer.from('%PDF-1.7 merged');
const range = (from: number, to: number) => Array.from({length: to - from + 1}, (_, index) => from + index);

/** parse-test.v1 output: 40 completion questions per skill; Listening has a transcript. */
function outline(skills: Skill[], transcript = true): ParseTestOutput {
  return {
    title: 'Cambridge 18 Test 1',
    sections: skills.map(skill => ({
      skill,
      passages: [
        {
          title: skill === 'reading' ? 'Urban farming' : 'Part 1',
          paragraphs:
            skill === 'listening' && !transcript
              ? null
              : [{label: skill === 'reading' ? 'A' : 'Woman', text: 'Farms grow on roofs.'}],
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

  async function setup(
    skills: Skill[],
    options: {
      pages?: PageLabels[];
      skip?: number[];
      audio?: boolean;
      transcript?: boolean;
      parseAudio?: ParseAudio;
      /** OCR text the browser sent for the PDF. */
      pageText?: {page: number; text: string}[];
      /** Gives the processor the v3 reader that works from the OCR text. */
      textReader?: boolean;
    } = {},
  ) {
    const state = makeImportRepository();
    const pdf = await state.repository.createFile('owner', {
      storageKey: 'merged.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF.length,
      originalName: 'test.pdf',
      durationSec: null,
      pageText: options.pageText,
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
    const parseTest = vi.fn(async () => outline(skills, options.transcript));
    const parseAudio = options.parseAudio && vi.fn(options.parseAudio);
    const parseTestText = options.textReader ? vi.fn(async () => outline(skills, options.transcript)) : undefined;
    const parseAnswers = vi.fn(async () => answerKey(skills, options.skip));
    const process = createImportProcessor({
      repository: state.repository,
      storage,
      labelPages: async () => options.pages ?? PAGES,
      parseTest,
      parseTestText,
      parseAnswers,
      parseAudio,
    });
    const job: ImportJob = {
      id: 'import',
      ownerId: 'owner',
      kind: skills.length === 2 ? 'full' : skills[0],
      questionFileId: pdf.id,
      answerFileId: pdf.id,
      audioFileId: audio?.id ?? null,
    };
    return {state, parseTest, parseTestText, parseAnswers, parseAudio, run: () => process(job, {validating})};
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

  it('reads the test from the OCR text, not the scan, when every page of the test has text', async () => {
    const pageText = [
      {page: 1, text: 'READING PASSAGE 1'},
      {page: 2, text: 'Answer key'},
      {page: 3, text: 'not a test page'},
    ];
    const {parseTest, parseTestText, parseAnswers, run} = await setup(['reading'], {pageText, textReader: true});

    const outcome = await run();

    expect(outcome.status).toBe('done');
    expect(parseTestText).toHaveBeenCalledWith([{page: 1, text: 'READING PASSAGE 1'}], {userId: 'owner'});
    expect(parseTest).not.toHaveBeenCalled();
    expect(parseAnswers).toHaveBeenCalledWith(PDF, {pages: [2], userId: 'owner'});
  });

  it('reads the scan as before when a page of the test has no text, or there is no text reader', async () => {
    for (const options of [
      {pageText: [{page: 1, text: '   '}], textReader: true},
      {pageText: [{page: 2, text: 'Answer key'}], textReader: true},
      {pageText: undefined, textReader: true},
      {pageText: [{page: 1, text: 'READING PASSAGE 1'}], textReader: false},
    ]) {
      const {parseTest, parseTestText, run} = await setup(['reading'], options);

      const outcome = await run();

      expect(outcome.status, JSON.stringify(options)).toBe('done');
      expect(parseTest).toHaveBeenCalledWith(PDF, {pages: [1], userId: 'owner'});
      expect(parseTestText?.mock.calls.length ?? 0).toBe(0);
    }
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

  describe('Listening transcript from the audio (P3-18)', () => {
    const heard: Awaited<ReturnType<ParseAudio>> = {
      parts: [{part: 1, lines: [{label: 'Woman', text: 'Shall we meet at the library?'}]}],
    };

    it('writes the transcript when the files have none, says so, and leaves the part start empty', async () => {
      const {state, parseAudio, run} = await setup(['listening'], {
        audio: true,
        transcript: false,
        parseAudio: async () => heard,
      });

      const outcome = await run();

      expect(parseAudio).toHaveBeenCalledWith(PDF, {mimeType: 'audio/mpeg', parts: 1, userId: 'owner'});
      expect(outcome.status).toBe('done');
      const codes = outcome.issues.map(issue => issue.code);
      expect(codes).toContain('TRANSCRIPT_BY_AI');
      expect(codes).not.toContain('TRANSCRIPT_MISSING');
      const passage = state.savedTests.get((outcome as {testId: string}).testId)!.test.sections[0].passages[0];
      expect(passage).toMatchObject({
        paragraphs: [{label: 'Woman', text: 'Shall we meet at the library?'}],
        audioStartSec: null,
      });
    });

    it('does not listen when the files already have a transcript', async () => {
      const {parseAudio, run} = await setup(['listening'], {audio: true, parseAudio: async () => heard});

      const outcome = await run();

      expect(parseAudio).not.toHaveBeenCalled();
      expect(outcome.issues.map(issue => issue.code)).not.toContain('TRANSCRIPT_BY_AI');
    });

    it('keeps the warning and still creates the test when the AI cannot write the transcript', async () => {
      const failure = new AppError('down', 503, undefined, 'AI_UNAVAILABLE');
      const {state, run} = await setup(['listening'], {
        audio: true,
        transcript: false,
        parseAudio: async () => Promise.reject(failure),
      });

      const outcome = await run();

      expect(outcome.status).toBe('done');
      expect(outcome.issues.map(issue => issue.code)).toContain('TRANSCRIPT_MISSING');
      expect(outcome.issues.map(issue => issue.code)).not.toContain('TRANSCRIPT_BY_AI');
      expect(state.savedTests.size).toBe(1);
    });

    it('does not hide a bug: an error that is not an AI error fails the import', async () => {
      const {run} = await setup(['listening'], {
        audio: true,
        transcript: false,
        parseAudio: async () => Promise.reject(new TypeError('bug')),
      });

      await expect(run()).rejects.toThrow('bug');
    });

    it('leaves a part the AI did not write without transcript and without start', async () => {
      const {run} = await setup(['listening'], {
        audio: true,
        transcript: false,
        parseAudio: async () => ({parts: []}),
      });

      const outcome = await run();

      expect(outcome.issues.map(issue => issue.code)).toContain('TRANSCRIPT_MISSING');
    });
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
