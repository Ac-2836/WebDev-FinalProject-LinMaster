import {describe, expect, it} from 'vitest';
import {CERTIFICATIONS, type ParsedTest} from '@linmaster/shared';
import {formatNumbers, validateParsedTest} from '../../src/modules/exam/import-validator';

type Group = ParsedTest['sections'][number]['passages'][number]['groups'][number];

const range = (from: number, to: number) => Array.from({length: to - from + 1}, (_, index) => from + index);

function group(kind: Group['kind'], from: number, to: number, answer: (n: number) => unknown): Group {
  const questions = range(from, to).map(number => ({
    number,
    prompt: `Q${number}`,
    options: null,
    answer: answer(number),
  }));
  return {kind, fromNo: from, toNo: to, instructions: 'Answer.', wordLimit: null, shared: null, questions};
}

const explained = (value: object) => ({...value, explanation: 'Because.'});

/** A valid Full test: Listening 1–40 with a transcript, Reading 1–40, every answer explained. */
function fullTest(): ParsedTest {
  return {
    title: 'Cambridge 18 Test 1',
    kind: 'full',
    source: null,
    sections: [
      {
        skill: 'reading',
        passages: [
          {
            title: 'Urban farming',
            paragraphs: [{label: 'A', text: 'Farms grow on roofs.'}],
            audioStartSec: null,
            groups: [
              group('tfng', 1, 13, () => explained({value: 'true'})),
              group('completion', 14, 40, () => explained({accepted: ['roofs']})),
            ],
          },
        ],
      },
      {
        skill: 'listening',
        passages: [
          {
            title: 'Part 1',
            paragraphs: [{label: 'Woman', text: 'Hello.'}],
            audioStartSec: null,
            groups: [
              group('multi_choice', 1, 2, () => explained({choices: ['A', 'C']})),
              group('completion', 3, 40, () => explained({accepted: ['library']})),
            ],
          },
        ],
      },
    ],
  };
}

const validate = (test: ParsedTest, audio: {durationSec: number | null} | null = {durationSec: 1680}) =>
  validateParsedTest({test, kind: 'full', certification: CERTIFICATIONS.IELTS_ACADEMIC, audio});
const codes = (test: ParsedTest, audio?: {durationSec: number | null} | null) =>
  validate(test, audio).issues.map(issue => [issue.severity, issue.code, issue.section, issue.questionNo]);

describe('validateParsedTest', () => {
  it('accepts a valid test, puts Listening first and makes every answer canonical', () => {
    const {issues, test} = validate(fullTest());

    expect(issues).toEqual([]);
    expect(test.sections.map(section => section.skill)).toEqual(['listening', 'reading']);
    expect(test.sections[1].passages[0].groups[0].questions[0].answer).toEqual({
      value: 'TRUE',
      explanation: 'Because.',
    });
  });

  it('reports missing and invalid answers by question number', () => {
    const test = fullTest();
    const questions = test.sections[0].passages[0].groups[0].questions;
    questions[2].answer = null;
    questions[4].answer = {value: 'maybe'};

    expect(codes(test)).toEqual([
      ['error', 'ANSWER_MISSING', 'reading', 3],
      ['error', 'ANSWER_INVALID', 'reading', 5],
    ]);
  });

  it('reports a wrong question count and broken numbering', () => {
    const test = fullTest();
    const questions = test.sections[1].passages[0].groups[1].questions;
    questions.pop();
    questions[0].number = 4;

    expect(codes(test)).toEqual([
      ['error', 'QUESTION_COUNT', 'listening', undefined],
      ['error', 'QUESTION_NUMBERING', 'listening', 4],
      ['error', 'QUESTION_NUMBERING', 'listening', 3],
      ['error', 'QUESTION_NUMBERING', 'listening', 40],
    ]);
  });

  it('blocks a Choose TWO group whose letters do not match its questions, and kinds the skill does not use', () => {
    const test = fullTest();
    const listening = test.sections[1].passages[0].groups;
    listening[0] = group('multi_choice', 1, 2, () => explained({choices: ['A', 'C', 'E']}));
    listening[1] = group('tfng', 3, 40, () => explained({value: 'TRUE'}));

    expect(codes(test).map(([, code]) => code)).toEqual(['MULTI_CHOICE_MISMATCH', 'KIND_NOT_ALLOWED']);
  });

  it('blocks a missing section, a Reading passage without text and Listening without usable audio', () => {
    const test = fullTest();
    test.sections[0].passages[0].paragraphs = null;

    expect(codes({...test, sections: [test.sections[0]]}, null).map(([, code]) => code)).toEqual([
      'SECTION_MISSING',
      'PASSAGE_TEXT_MISSING',
      'AUDIO_MISSING',
    ]);
    expect(codes(fullTest(), {durationSec: null})).toEqual([
      ['error', 'AUDIO_DURATION_UNKNOWN', 'listening', undefined],
    ]);
  });

  it('only warns about missing explanations, missing transcripts and parts outside the kind', () => {
    const test = fullTest();
    test.sections[1].passages[0].paragraphs = null;
    for (const question of test.sections[0].passages[0].groups[0].questions.slice(0, 3)) {
      question.answer = {value: 'FALSE'};
    }

    const result = validateParsedTest({
      test,
      kind: 'reading',
      certification: CERTIFICATIONS.IELTS_ACADEMIC,
      audio: null,
    });

    expect(result.issues.map(issue => [issue.severity, issue.code])).toEqual([
      ['warning', 'SECTION_IGNORED'],
      ['warning', 'EXPLANATION_MISSING'],
    ]);
    expect(result.issues[1].message).toContain('1–3');
    expect(result.test.sections.map(section => section.skill)).toEqual(['reading']);
    expect(
      codes(test)
        .filter(([severity]) => severity === 'warning')
        .map(([, code]) => code),
    ).toEqual(['TRANSCRIPT_MISSING', 'EXPLANATION_MISSING']);
  });

  it('formats question numbers as ranges', () => {
    expect(formatNumbers([7, 1, 2, 3, 3, 9, 10])).toBe('1–3, 7, 9–10');
  });
});
