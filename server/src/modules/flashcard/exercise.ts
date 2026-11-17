import {
  EXERCISE_BLANK,
  EXERCISE_CHOICES,
  EXERCISE_MAX_MATCHES,
  EXERCISE_MIN_MATCHES,
  type ExerciseKind,
  type ExerciseQuestion,
  type FlashcardCard,
  type GeneratedExercise,
} from '@linmaster/shared';

export type ExerciseCard = Pick<FlashcardCard, 'id' | 'term' | 'definition'>;

const MAX_PROMPT_LENGTH = 500;
const MAX_SPARE_OPTIONS = 2;

const norm = (text: string) => text.trim().replace(/\s+/gu, ' ').toLowerCase();

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The term as a whole word or phrase (any whitespace between its words), not inside a longer word. */
function containsTerm(text: string, term: string): boolean {
  const words = norm(term).split(' ').map(escape).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${words}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

/** A sentence with exactly one gap that does not already contain the answer as a word. */
function goodSentence(prompt: string, answer: string): boolean {
  const text = prompt.trim();
  return (
    text.length > 0 &&
    text.length <= MAX_PROMPT_LENGTH &&
    text.split(EXERCISE_BLANK).length === 2 &&
    !containsTerm(text, answer)
  );
}

type GeneratedQuestion = GeneratedExercise['questions'][number];

/**
 * The model often writes one matching question with 6 or more sentences, or lists every word as an option. Splits a
 * long one into questions of at most 5 sentences (about equal), and gives each the answers of its own sentences plus
 * up to 2 spare words of the set, so those outputs are used instead of retried. Other kinds pass through.
 */
function repairMatching(question: GeneratedQuestion, byTerm: Map<string, ExerciseCard>): GeneratedQuestion[] {
  if (question.kind !== 'matching') return [question];
  const total = question.items.length;
  const groups = Math.max(1, Math.ceil(total / EXERCISE_MAX_MATCHES));
  let from = 0;
  return Array.from({length: groups}, (_, index) => {
    const items = question.items.slice(from, (from += Math.floor(total / groups) + (index < total % groups ? 1 : 0)));
    const answers = new Set(items.map(item => norm(item.answer)));
    const spare = [...new Set(question.options.map(norm))].filter(option => !answers.has(option) && byTerm.has(option));
    return {...question, items, options: [...items.map(item => item.answer), ...spare.slice(0, MAX_SPARE_OPTIONS)]};
  });
}

/**
 * Checks each generated question against the set (PLAN C3): right shape for its kind, one gap, the answer among the
 * options, and every answer and option a term of the set (written as in the set). A question that fails is
 * dropped, and so is one that asks a card an earlier question already asked; the others keep their order. Options are shuffled, so the model's habits do not decide where the
 * answer sits.
 */
export function buildExercise(
  generated: GeneratedExercise,
  cards: ExerciseCard[],
  {kinds, count}: {kinds: ExerciseKind[]; count: number},
  random: () => number = Math.random,
): ExerciseQuestion[] {
  const byTerm = new Map<string, ExerciseCard>();
  for (const card of cards) if (!byTerm.has(norm(card.term))) byTerm.set(norm(card.term), card);
  const seen = new Set<string>();
  const asked = new Set<string>();

  const check = (item: GeneratedExercise['questions'][number]): ExerciseQuestion | null => {
    if (!kinds.includes(item.kind)) return null;
    if (item.kind === 'completion') {
      const card = byTerm.get(norm(item.answer));
      if (!card || !goodSentence(item.prompt, card.term)) return null;
      return {kind: 'completion', cardId: card.id, prompt: item.prompt.trim(), answer: card.term};
    }
    if (item.kind === 'single_choice') {
      const card = byTerm.get(norm(item.answer));
      const options = item.options.map(option => byTerm.get(norm(option)));
      const distinct = new Set(options.map(option => option?.id));
      if (!card || !goodSentence(item.prompt, card.term)) return null;
      if (options.length !== EXERCISE_CHOICES || options.includes(undefined) || distinct.size !== EXERCISE_CHOICES) {
        return null;
      }
      if (!distinct.has(card.id)) return null;
      const terms = options.map(option => option!.term);
      return {
        kind: 'single_choice',
        cardId: card.id,
        prompt: item.prompt.trim(),
        options: shuffle(terms, random),
        answer: card.term,
      };
    }
    const items = item.items.map(({prompt, answer}) => ({prompt, card: byTerm.get(norm(answer))}));
    const options = item.options.map(option => byTerm.get(norm(option)));
    const answerIds = new Set(items.map(({card}) => card?.id));
    const optionIds = new Set(options.map(option => option?.id));
    if (items.length < EXERCISE_MIN_MATCHES || items.length > EXERCISE_MAX_MATCHES) return null;
    if (items.some(({prompt, card}) => !card || !goodSentence(prompt, card.term))) return null;
    if (answerIds.size !== items.length) return null;
    if (options.includes(undefined) || optionIds.size !== options.length) return null;
    if (![...answerIds].every(id => optionIds.has(id))) return null;
    if (options.length > items.length + MAX_SPARE_OPTIONS) return null;
    return {
      kind: 'matching',
      items: items.map(({prompt, card}) => ({cardId: card!.id, prompt: prompt.trim(), answer: card!.term})),
      options: shuffle(
        options.map(option => option!.term),
        random,
      ),
    };
  };

  const questions: ExerciseQuestion[] = [];
  let size = 0;
  for (const item of generated.questions.flatMap(question => repairMatching(question, byTerm))) {
    const question = size < count ? check(item) : null;
    // A matching question that would go over the count is dropped (the model counts its sentences wrongly).
    if (!question || size + exerciseSize([question]) > count) continue;
    const ids = question.kind === 'matching' ? question.items.map(entry => entry.cardId) : [question.cardId];
    if (ids.some(cardId => asked.has(cardId))) continue;
    // The same sentence twice is one question.
    const key = norm(question.kind === 'matching' ? question.items.map(i => i.prompt).join('|') : question.prompt);
    if (seen.has(key)) continue;
    seen.add(key);
    ids.forEach(cardId => asked.add(cardId));
    size += exerciseSize([question]);
    questions.push(question);
  }
  return questions;
}

/** Numbered questions of an exercise: a matching question counts one per sentence, as in an exam. */
export const exerciseSize = (questions: ExerciseQuestion[]) =>
  questions.reduce((sum, question) => sum + (question.kind === 'matching' ? question.items.length : 1), 0);

/**
 * Fewer than half of the questions asked for is too little to give back (PLAN C3). A card is asked once, so a set
 * of 4 cards can give at most 4 questions: `count` is measured against the cards as well.
 */
export const enough = (valid: number, count: number, cardCount: number) =>
  valid >= Math.ceil(Math.min(count, cardCount) / 2);
