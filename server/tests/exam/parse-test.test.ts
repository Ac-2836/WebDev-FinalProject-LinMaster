import {
  gradeGroup,
  type ParseAnswersOutput,
  type ParsedAnswer,
  ParsedTestSchema,
  type ParseTestOutput,
  parseAnswer,
  type QuestionKind,
} from '@linmaster/shared';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {setAiModel} from '../../src/core/ai/ai-gateway';
import {createMockAiModel} from '../../src/core/ai/ai-model';
import {getDb} from '../../src/core/db';
import {buildParsedTest, parseAnswers, parseTest, toQuestionAnswer} from '../../src/modules/exam/ai';

const entry = (answer: string, number = 1, explanation: string | null = null): ParsedAnswer => ({
  skill: 'reading',
  number,
  answer,
  explanation,
});

describe('toQuestionAnswer', () => {
  // Printed answers taken from the sample answer keys (R0, L0), each must give a valid answer that grades right.
  const cases: Array<[QuestionKind, string, string]> = [
    ['tfng', 'NOT GIVEN', 'not given'],
    ['ynng', 'YES', 'Yes'],
    ['matching', 'iii', 'iii'],
    ['matching', 'B', 'b'],
    ['single_choice', 'C', 'C'],
    ['completion', '19 OR nineteen', 'nineteen'],
    ['completion', 'cloud / clouds', 'clouds'],
    ['completion', '(a) fifth / one fifth', 'a fifth'],
    ['short_answer', '(small) grants', 'grants'],
    ['diagram_label', 'G', 'G'],
  ];
  it.each(cases)('%s %s', (kind, printed, typed) => {
    const answer = toQuestionAnswer(kind, entry(printed), [entry(printed)]);
    expect(parseAnswer(kind, answer).success).toBe(true);
    expect(gradeGroup(kind, [{given: typed, answer}], {wordLimit: 2})).toEqual([true]);
  });

  it('gives every question of a "choose TWO" group both letters, in any order', () => {
    const group = [entry('A, C (in either order)', 21), entry('A, C (in either order)', 22)];
    const answers = group.map(item => toQuestionAnswer('multi_choice', item, group));
    expect(answers).toEqual([{choices: ['A', 'C']}, {choices: ['A', 'C']}]);
    const separate = [entry('C', 21), entry('A', 22)];
    expect(toQuestionAnswer('multi_choice', separate[0], separate)).toEqual({choices: ['C', 'A']});
    expect(
      gradeGroup('multi_choice', [
        {given: 'C', answer: answers[0]},
        {given: 'A', answer: answers[1]},
      ]),
    ).toEqual([true, true]);
  });

  it('keeps a printed explanation', () => {
    expect(toQuestionAnswer('tfng', entry('TRUE', 1, ' Paragraph 2. '), [])).toEqual({
      value: 'TRUE',
      explanation: 'Paragraph 2.',
    });
  });
});

const outline: ParseTestOutput = {
  title: 'Full test',
  sections: [
    {
      skill: 'reading',
      passages: [
        {
          title: 'Islands',
          paragraphs: [
            {label: 'A', text: 'Para A.'},
            {label: null, text: 'Para B.'},
          ],
          groups: [
            {
              kind: 'tfng',
              fromNo: 1,
              toNo: 2,
              instructions: 'Write TRUE, FALSE or NOT GIVEN.',
              wordLimit: null,
              optionsTitle: null,
              options: null,
              content: null,
              questions: [
                {number: 1, prompt: 'Statement one.', options: null},
                {number: 2, prompt: 'Statement two.', options: []},
              ],
            },
          ],
        },
      ],
    },
    {
      skill: 'listening',
      passages: [
        {
          title: 'Part 1',
          paragraphs: [{label: 'Receptionist', text: 'Good morning.'}],
          groups: [
            {
              kind: 'completion',
              fromNo: 1,
              toNo: 1,
              instructions: 'Write ONE WORD ONLY.',
              wordLimit: 1,
              optionsTitle: ' ',
              options: null,
              content: [
                {type: 'text', text: 'Name: Daniel {{1}}', rows: null},
                {type: 'table', text: null, rows: [['Cost', '£32']]},
                {type: 'text', text: '  ', rows: null},
              ],
              questions: [{number: 1, prompt: 'Name: Daniel {{blank}}', options: null}],
            },
          ],
        },
      ],
    },
  ],
};

describe('buildParsedTest', () => {
  it('joins outline and key per skill, puts Listening first and leaves missing answers null', () => {
    const key: ParseAnswersOutput = {
      answers: [
        {skill: 'reading', number: 1, answer: 'TRUE', explanation: 'Para A.'},
        {skill: 'listening', number: 1, answer: 'Fairbank', explanation: null},
      ],
    };
    const test = ParsedTestSchema.parse(buildParsedTest(outline, key, 'full'));

    expect(test.sections.map(section => section.skill)).toEqual(['listening', 'reading']);
    const [listening, reading] = test.sections;
    expect(listening.passages[0].groups[0].questions[0].answer).toEqual({accepted: ['Fairbank']});
    expect(listening.passages[0].groups[0].shared).toEqual({
      content: [
        {type: 'text', text: 'Name: Daniel {{1}}'},
        {type: 'table', rows: [['Cost', '£32']]},
      ],
    });
    expect(listening.passages[0].paragraphs).toEqual([{label: 'Receptionist', text: 'Good morning.'}]);
    expect(reading.passages[0].paragraphs).toEqual([{label: 'A', text: 'Para A.'}, {text: 'Para B.'}]);
    expect(reading.passages[0].groups[0].shared).toBeNull();
    expect(reading.passages[0].groups[0].questions.map(q => q.answer)).toEqual([
      {value: 'TRUE', explanation: 'Para A.'},
      null,
    ]);
    expect(reading.passages[0].groups[0].questions[1].options).toBeNull();
  });

  it('switches TRUE/FALSE and YES/NO groups to the kind their printed answers show', () => {
    const key = (...values: string[]): ParseAnswersOutput => ({
      answers: values.map((answer, index) => ({skill: 'reading', number: index + 1, answer, explanation: null})),
    });
    const groupKind = (built: ReturnType<typeof buildParsedTest>) => built.sections[1].passages[0].groups[0].kind;

    // The outline says tfng; YES / NO answers make it ynng, and the answers stay valid.
    const swapped = buildParsedTest(outline, key('YES', 'NOT GIVEN'), 'full');
    expect(groupKind(swapped)).toBe('ynng');
    for (const question of swapped.sections[1].passages[0].groups[0].questions) {
      expect(parseAnswer('ynng', question.answer).success).toBe(true);
    }
    // Only NOT GIVEN answers cannot tell the two apart: the outline's kind stays.
    expect(groupKind(buildParsedTest(outline, key('NOT GIVEN', 'NG'), 'full'))).toBe('tfng');
  });
});

// Real test database (AiCache, AiUsage); only the model is the mock, Gemini is never called.
describe('parseTest and parseAnswers', () => {
  const db = getDb();
  const email = `parse-${Date.now()}@linmaster.test`;
  const pdf = Buffer.from(`%PDF-1.4 parse test ${Date.now()}`);
  let userId: string;

  beforeAll(async () => {
    userId = (await db.user.create({data: {email, passwordHash: 'x', displayName: 'Parse'}})).id;
  });
  afterAll(async () => {
    await db.aiCache.deleteMany({
      where: {task: {in: ['parse-test.v2', 'parse-transcript.v1', 'parse-answers.v1']}, model: 'mock-model'},
    });
    await db.user.deleteMany({where: {email}});
    await db.$disconnect();
  });

  it('sends the PDF with only the chosen pages and caches per page set', async () => {
    const key: ParseAnswersOutput = {answers: [{skill: 'reading', number: 1, answer: 'TRUE', explanation: null}]};
    const model = createMockAiModel([{...outline, hasTranscript: false}, key, key]);
    setAiModel(model);

    expect(await parseTest(pdf, {pages: [3, 1, 3], userId})).toEqual(outline);
    expect(await parseAnswers(pdf, {pages: [7], userId})).toEqual(key);
    expect(await parseAnswers(pdf, {pages: [7], userId})).toEqual(key); // cached
    expect(await parseAnswers(pdf, {pages: [7, 8], userId})).toEqual(key); // other pages: new call

    expect(model.requests.map(request => request.text)).toEqual([
      'Read only these pages of the attached PDF: 1, 3.',
      'Read only these pages of the attached PDF: 7.',
      'Read only these pages of the attached PDF: 7, 8.',
    ]);
    expect(model.requests[0].pdf?.equals(pdf)).toBe(true);
  });

  it('refuses an empty page list', async () => {
    await expect(parseTest(pdf, {pages: [], userId})).rejects.toThrow(/page/);
  });

  // Listening parts without transcript, as parse-test.v2 returns them.
  const withoutTranscript = (hasTranscript: boolean) => ({
    ...outline,
    hasTranscript,
    sections: outline.sections.map(section => ({
      ...section,
      passages: section.passages.map(passage =>
        section.skill === 'listening' ? {...passage, paragraphs: null} : passage,
      ),
    })),
  });

  it('reads the transcript in its own call and puts its lines on the Listening parts', async () => {
    const model = createMockAiModel([
      withoutTranscript(true),
      {parts: [{part: 1, lines: [{label: 'Receptionist', text: 'Good morning.'}]}]},
    ]);
    setAiModel(model);

    const result = await parseTest(Buffer.from(`${pdf} transcript`), {pages: [1, 9], userId});

    expect(result).toEqual(outline); // hasTranscript is not part of the result
    expect(model.requests[1].text).toBe(
      'Read only these pages of the attached PDF: 1, 9. The test has 1 Listening parts.',
    );
  });

  it('skips the transcript call when the pages hold no transcript', async () => {
    const model = createMockAiModel([withoutTranscript(false)]);
    setAiModel(model);
    const result = await parseTest(Buffer.from(`${pdf} no transcript`), {pages: [1], userId});
    expect(result.sections[1].passages[0].paragraphs).toBeNull();
    expect(model.requests).toHaveLength(1);
  });

  it('retries a test whose Reading passage came back without text, and caches only the full one', async () => {
    const empty = {
      ...withoutTranscript(false),
      sections: withoutTranscript(false).sections.map(section => ({
        ...section,
        passages: section.passages.map(passage =>
          section.skill === 'reading' ? {...passage, paragraphs: null} : passage,
        ),
      })),
    };
    const model = createMockAiModel([empty, withoutTranscript(false)]);
    setAiModel(model);
    const file = Buffer.from(`${pdf} retry`);

    const first = await parseTest(file, {pages: [2], userId});
    const second = await parseTest(file, {pages: [2], userId});

    expect(first.sections[0].passages[0].paragraphs).toHaveLength(2);
    expect(second).toEqual(first);
    expect(model.requests).toHaveLength(2); // one retry, then the cache
  });

  it('returns the transcript it got, without caching it, when parts stay missing', async () => {
    const partial = {parts: [{part: 1, lines: []}]};
    const model = createMockAiModel([withoutTranscript(true), partial, partial, partial]);
    setAiModel(model);
    const file = Buffer.from(`${pdf} missing transcript`);
    const cachedTranscripts = () => db.aiCache.count({where: {task: 'parse-transcript.v1', model: 'mock-model'}});
    const before = await cachedTranscripts();

    const result = await parseTest(file, {pages: [9], userId});

    // Three attempts, then the outline without transcript: the import validator warns TRANSCRIPT_MISSING.
    expect(result.sections[1].passages[0].paragraphs).toBeNull();
    expect(model.requests).toHaveLength(4);
    expect(await cachedTranscripts()).toBe(before);
  });
});
