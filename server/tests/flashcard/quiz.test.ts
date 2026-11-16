import {describe, expect, it} from 'vitest';
import {QuizQuestionSchema} from '@linmaster/shared';
import {buildQuiz} from '../../src/modules/flashcard/quiz';

const id = (n: number) => `0192f7e0-0bcd-7000-8000-${String(n).padStart(12, '0')}`;
const cards = (...defs: string[]) => defs.map((definition, i) => ({id: id(i), term: `term${i}`, definition}));
const SIX = cards('a', 'b', 'c', 'd', 'e', 'f');

describe('buildQuiz', () => {
  it('asks each card at most once and defaults to every kind', () => {
    const quiz = buildQuiz(SIX, {count: 6});

    expect(new Set(quiz.map(q => q.cardId)).size).toBe(6);
    expect(new Set(quiz.map(q => q.kind))).toEqual(new Set(['multiple-choice', 'written', 'true-false']));
    quiz.forEach(q => expect(QuizQuestionSchema.safeParse(q).success).toBe(true));
  });

  it('caps the count at the number of cards and honours `kinds`', () => {
    const quiz = buildQuiz(SIX, {count: 50, kinds: 'written'});

    expect(quiz).toHaveLength(6);
    expect(quiz.every(q => q.kind === 'written')).toBe(true);
  });

  it('keeps the answer among four distinct options', () => {
    for (let run = 0; run < 50; run++) {
      for (const q of buildQuiz(SIX, {kinds: 'multiple-choice'})) {
        if (q.kind !== 'multiple-choice') throw new Error('unexpected kind');
        const card = SIX.find(c => c.id === q.cardId)!;
        expect(q.prompt).toBe(card.term);
        expect(q.answer).toBe(card.definition);
        expect(q.options).toContain(card.definition);
        expect(new Set(q.options).size).toBe(4);
      }
    }
  });

  it('builds true-false statements that match their answer', () => {
    for (let run = 0; run < 50; run++) {
      for (const q of buildQuiz(SIX, {kinds: 'true-false'})) {
        if (q.kind !== 'true-false') throw new Error('unexpected kind');
        const card = SIX.find(c => c.id === q.cardId)!;
        expect(q.statement === card.definition).toBe(q.answer);
      }
    }
  });

  it('asks the definition and expects the term for written questions', () => {
    const [q] = buildQuiz(SIX, {count: 1, kinds: 'written'});
    const card = SIX.find(c => c.id === q!.cardId)!;

    expect(q).toEqual({kind: 'written', cardId: card.id, prompt: card.definition, answer: card.term});
  });

  it('falls back to another kind when identical definitions leave too few distractors', () => {
    const same = cards('x', 'X ', 'x', 'y');
    const quiz = buildQuiz(same, {kinds: 'multiple-choice'});

    expect(quiz.filter(q => q.kind === 'multiple-choice')).toHaveLength(0);
    expect(quiz).toHaveLength(4);
  });

  it('never offers a copy of the answer as a wrong option or false statement', () => {
    const dup = cards('x', 'x', 'y', 'z', 'w');
    for (let run = 0; run < 50; run++) {
      for (const q of buildQuiz(dup, {kinds: 'true-false'})) {
        if (q.kind === 'true-false') {
          const card = dup.find(c => c.id === q.cardId)!;
          expect(q.answer).toBe(q.statement === card.definition);
        }
      }
    }
  });

  const sameTerm = [
    {id: id(0), term: 'bank', definition: 'ngân hàng'},
    {id: id(1), term: 'Bank ', definition: 'bờ sông'},
    {id: id(2), term: 'cat', definition: 'mèo'},
    {id: id(3), term: 'dog', definition: 'chó'},
    {id: id(4), term: 'egg', definition: 'trứng'},
  ];

  it('never offers another meaning of the same term as a wrong option or false statement', () => {
    for (let run = 0; run < 100; run++) {
      for (const q of buildQuiz(sameTerm, {count: 5, kinds: 'multiple-choice,true-false'})) {
        if (q.prompt.trim().toLowerCase() !== 'bank') continue;
        if (q.kind === 'multiple-choice') {
          expect(q.options).not.toContain(q.answer === 'ngân hàng' ? 'bờ sông' : 'ngân hàng');
        } else if (q.kind === 'true-false') {
          expect(q.answer).toBe(q.statement === sameTerm.find(c => c.id === q.cardId)!.definition);
          expect(['ngân hàng', 'bờ sông']).not.toContain(q.answer ? '' : q.statement);
        }
      }
    }
  });

  it('does not type-ask a definition that several terms share', () => {
    const synonyms = [
      {id: id(0), term: 'big', definition: 'lớn'},
      {id: id(1), term: 'large', definition: 'lớn'},
      {id: id(2), term: 'cat', definition: 'mèo'},
      {id: id(3), term: 'dog', definition: 'chó'},
    ];
    for (let run = 0; run < 50; run++) {
      const written = buildQuiz(synonyms, {kinds: 'written'}).filter(q => q.kind === 'written');
      expect(written.map(q => q.prompt)).not.toContain('lớn');
    }
  });
});
