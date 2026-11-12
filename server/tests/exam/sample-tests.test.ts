import {gradeGroup} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {loadSampleTest} from '../../prisma/seed-tests';

// The seed data must stay a valid structured test: right part and question counts, answers valid for their kind.
describe('sample tests of the seed', () => {
  it.each(['sample-reading-test.json', 'sample-listening-test.json'])(
    '%s loads and every answer grades itself',
    file => {
      const test = loadSampleTest(file);
      for (const group of test.sections.flatMap(section => section.passages.flatMap(passage => passage.groups))) {
        // A learner typing the stored answer gets the mark (optional words in brackets dropped).
        const given = group.questions.map((question, index) => {
          const answer = question.answer as {value?: string; accepted?: string[]; choices?: string[]};
          return answer.value ?? answer.choices?.[index] ?? answer.accepted![0].replace(/\([^)]*\)\s*/gu, '');
        });
        const items = group.questions.map((question, index) => ({given: given[index], answer: question.answer}));
        expect(gradeGroup(group.kind, items, {wordLimit: group.wordLimit})).toEqual(items.map(() => true));
      }
    },
  );

  it('keeps explanations for Reading and a transcript and audio start for every Listening part', () => {
    const reading = loadSampleTest('sample-reading-test.json');
    const readingQuestions = reading.sections[0].passages.flatMap(passage => passage.groups.flatMap(g => g.questions));
    expect(readingQuestions.every(question => (question.answer as {explanation?: string}).explanation)).toBe(true);

    const listening = loadSampleTest('sample-listening-test.json');
    for (const part of listening.sections[0].passages) {
      expect(part.paragraphs?.length).toBeGreaterThan(0);
      expect(part.audioStartSec).not.toBeNull();
    }
  });
});
