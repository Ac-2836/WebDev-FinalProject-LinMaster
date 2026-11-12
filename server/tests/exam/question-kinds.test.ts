import {describe, expect, it} from 'vitest';
import {
  type GradeItem,
  gradeGroup,
  gradeQuestion,
  parseAnswer,
  QUESTION_KINDS,
  type QuestionKind,
  QuestionKindSchema,
} from '@linmaster/shared';

const grade = (kind: QuestionKind, given: string | null, answer: unknown, wordLimit?: number) =>
  gradeQuestion(kind, {given, answer}, {wordLimit});

describe('question kind registry', () => {
  it('has one entry for every kind of the database enum', () => {
    expect(Object.keys(QUESTION_KINDS).sort()).toEqual([...QuestionKindSchema.options].sort());
    for (const [key, definition] of Object.entries(QUESTION_KINDS)) expect(definition.id).toBe(key);
  });

  it('treats a missing, null or blank answer as wrong for every kind', () => {
    const answers: Record<QuestionKind, unknown> = {
      single_choice: {accepted: ['B']},
      multi_choice: {choices: ['A', 'C']},
      tfng: {value: 'TRUE'},
      ynng: {value: 'NO'},
      matching: {accepted: ['iv']},
      completion: {accepted: ['library']},
      short_answer: {accepted: ['bus']},
      diagram_label: {accepted: ['bridge']},
    };
    for (const kind of QuestionKindSchema.options) {
      for (const given of [null, undefined, '', '   ']) {
        expect(gradeQuestion(kind, {given, answer: answers[kind]}), `${kind} ${JSON.stringify(given)}`).toBe(false);
      }
      expect(QUESTION_KINDS[kind].normalize('   ')).toBeNull();
    }
  });

  it('rejects an answer that does not fit the kind', () => {
    expect(parseAnswer('tfng', {value: 'MAYBE'}).success).toBe(false);
    expect(parseAnswer('tfng', {value: 'YES'}).success).toBe(false);
    expect(parseAnswer('ynng', {value: 'TRUE'}).success).toBe(false);
    expect(parseAnswer('single_choice', {accepted: []}).success).toBe(false);
    expect(parseAnswer('multi_choice', {choices: ['A']}).success).toBe(false);
    expect(parseAnswer('multi_choice', {choices: ['A', 'a']}).success).toBe(false);
    expect(parseAnswer('completion', {accepted: ['  ']}).success).toBe(false);
    expect(parseAnswer('completion', {accepted: ['x'], extra: 1}).success).toBe(false);
    expect(() => grade('completion', 'x', {value: 'x'})).toThrow();
  });

  it('canonicalises stored answers and keeps the explanation', () => {
    expect(parseAnswer('tfng', {value: 'ng', explanation: 'Paragraph C does not say.'}).data).toEqual({
      value: 'NOT GIVEN',
      explanation: 'Paragraph C does not say.',
    });
    expect(parseAnswer('matching', {accepted: [' iv ']}).data).toEqual({accepted: ['IV']});
  });
});

describe('single choice', () => {
  const answer = {accepted: ['B']};

  it('accepts the right letter in any case and ignores brackets or a dot', () => {
    for (const given of ['B', 'b', ' (B) ', 'B.']) expect(grade('single_choice', given, answer), given).toBe(true);
  });

  it('marks another letter wrong', () => {
    expect(grade('single_choice', 'C', answer)).toBe(false);
    expect(grade('single_choice', 'BC', answer)).toBe(false);
  });

  it('accepts any of several letters when the key allows them', () => {
    expect(grade('single_choice', 'D', {accepted: ['B', 'D']})).toBe(true);
  });
});

describe('multiple choice (choose N)', () => {
  const answer = {choices: ['A', 'D']};
  const items = (...given: (string | null)[]): GradeItem[] => given.map(value => ({given: value, answer}));

  it('gives a mark per correct letter in any order', () => {
    expect(gradeGroup('multi_choice', items('A', 'D'))).toEqual([true, true]);
    expect(gradeGroup('multi_choice', items('d', 'a'))).toEqual([true, true]);
  });

  it('gives one mark when only one letter is right', () => {
    expect(gradeGroup('multi_choice', items('A', 'B'))).toEqual([true, false]);
    expect(gradeGroup('multi_choice', items(null, 'D'))).toEqual([false, true]);
  });

  it('counts a repeated letter only once', () => {
    expect(gradeGroup('multi_choice', items('A', 'A'))).toEqual([true, false]);
  });

  it('grades a single question by membership', () => {
    expect(grade('multi_choice', 'D', answer)).toBe(true);
    expect(grade('multi_choice', 'B', answer)).toBe(false);
  });
});

describe('True / False / Not Given', () => {
  it('accepts the full word or its short form in any case', () => {
    expect(grade('tfng', 'true', {value: 'TRUE'})).toBe(true);
    expect(grade('tfng', 'T', {value: 'TRUE'})).toBe(true);
    expect(grade('tfng', 'not  given', {value: 'NOT GIVEN'})).toBe(true);
    expect(grade('tfng', 'NG', {value: 'not given'})).toBe(true);
    expect(grade('tfng', 'f', {value: 'F'})).toBe(true);
  });

  it('marks a different judgement wrong', () => {
    expect(grade('tfng', 'FALSE', {value: 'TRUE'})).toBe(false);
    expect(grade('tfng', 'NOT GIVEN', {value: 'FALSE'})).toBe(false);
    expect(grade('tfng', 'YES', {value: 'TRUE'})).toBe(false);
  });
});

describe('Yes / No / Not Given', () => {
  it('accepts the full word or its short form', () => {
    expect(grade('ynng', 'yes', {value: 'YES'})).toBe(true);
    expect(grade('ynng', 'N', {value: 'NO'})).toBe(true);
    expect(grade('ynng', 'Not Given', {value: 'NG'})).toBe(true);
  });

  it('marks a different judgement, or a True/False word, wrong', () => {
    expect(grade('ynng', 'NO', {value: 'YES'})).toBe(false);
    expect(grade('ynng', 'TRUE', {value: 'YES'})).toBe(false);
  });
});

describe('matching', () => {
  it('matches letters and roman numerals of headings in any case', () => {
    expect(grade('matching', 'iv', {accepted: ['iv']})).toBe(true);
    expect(grade('matching', 'IV', {accepted: ['iv']})).toBe(true);
    expect(grade('matching', 'E', {accepted: ['e']})).toBe(true);
  });

  it('does not confuse close numerals or letters', () => {
    expect(grade('matching', 'iii', {accepted: ['iv']})).toBe(false);
    expect(grade('matching', 'vi', {accepted: ['iv']})).toBe(false);
    expect(grade('matching', 'F', {accepted: ['E']})).toBe(false);
  });
});

describe('completion', () => {
  it('ignores case, extra spaces, end punctuation and a leading article', () => {
    const answer = {accepted: ['public library']};
    for (const given of ['Public Library', '  public   library ', 'public library.', 'the public library']) {
      expect(grade('completion', given, answer), given).toBe(true);
    }
  });

  it('accepts every spelling in the list and optional words in brackets', () => {
    expect(grade('completion', 'colour', {accepted: ['color', 'colour']})).toBe(true);
    expect(grade('completion', 'car park', {accepted: ['(the) car park']})).toBe(true);
    expect(grade('completion', 'the car park', {accepted: ['(the) car park']})).toBe(true);
    expect(grade('completion', 'park', {accepted: ['(the) car park']})).toBe(false);
  });

  it('marks a different or misspelt word wrong', () => {
    expect(grade('completion', 'libary', {accepted: ['library']})).toBe(false);
    expect(grade('completion', 'libraries', {accepted: ['library']})).toBe(false);
  });

  it('marks an answer over the word limit wrong, even when it contains the key', () => {
    const answer = {accepted: ['library']};
    expect(grade('completion', 'library', answer, 1)).toBe(true);
    expect(grade('completion', 'the library', answer, 1)).toBe(false);
    expect(grade('completion', 'the library', answer, 2)).toBe(true);
    expect(grade('completion', 'city library building', {accepted: ['city library building']}, 2)).toBe(false);
  });

  it('counts a hyphenated word as one word and does not count numbers', () => {
    expect(grade('completion', 'part-time job', {accepted: ['part-time job']}, 2)).toBe(true);
    expect(grade('completion', '25 metres', {accepted: ['25 metres']}, 1)).toBe(true);
  });

  it('matches numbers written with a thousands separator and straight or curly quotes', () => {
    expect(grade('completion', '1,500', {accepted: ['1500']})).toBe(true);
    expect(grade('completion', '£1,500', {accepted: ['1500']})).toBe(true);
    expect(grade('completion', 'children’s', {accepted: ["children's"]})).toBe(true);
  });
});

describe('short answer and diagram label', () => {
  it('grade like completion', () => {
    expect(grade('short_answer', 'By Bus', {accepted: ['bus']}, 2)).toBe(false);
    expect(grade('short_answer', 'a bus', {accepted: ['bus']}, 2)).toBe(true);
    expect(grade('short_answer', 'train', {accepted: ['bus']})).toBe(false);
    expect(grade('diagram_label', 'Wooden Bridge', {accepted: ['wooden bridge']}, 2)).toBe(true);
    expect(grade('diagram_label', 'g', {accepted: ['G']})).toBe(true);
    expect(grade('diagram_label', 'H', {accepted: ['G']})).toBe(false);
  });
});
