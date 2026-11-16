import {
  QUIZ_CHOICES,
  QUIZ_DEFAULT_QUESTIONS,
  QuizKindSchema,
  type FlashcardCard,
  type QuizKind,
  type QuizQuestion,
} from '@linmaster/shared';

type Pair = Pick<FlashcardCard, 'id' | 'term' | 'definition'>;

const norm = (text: string) => text.trim().toLowerCase();

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Other cards' definitions that differ from the answer and from each other, so no option is a duplicate. */
function distractors(card: Pair, cards: Pair[], random: () => number): string[] {
  const seen = new Set([norm(card.definition)]);
  const out: string[] = [];
  for (const other of shuffle(cards, random)) {
    if (other.id === card.id || seen.has(norm(other.definition))) continue;
    seen.add(norm(other.definition));
    out.push(other.definition);
  }
  return out;
}

function ask(card: Pair, kind: QuizKind, cards: Pair[], random: () => number): QuizQuestion {
  const wrong = distractors(card, cards, random);
  if (kind === 'multiple-choice' && wrong.length >= QUIZ_CHOICES - 1) {
    const options = shuffle([card.definition, ...wrong.slice(0, QUIZ_CHOICES - 1)], random);
    return {kind, cardId: card.id, prompt: card.term, options, answer: card.definition};
  }
  if (kind === 'true-false' && wrong.length > 0) {
    const isTrue = random() < 0.5;
    return {kind, cardId: card.id, prompt: card.term, statement: isTrue ? card.definition : wrong[0]!, answer: isTrue};
  }
  // Also the fallback when a set has too many identical definitions to build the other kinds.
  return {kind: 'written', cardId: card.id, prompt: card.definition, answer: card.term};
}

/** One question per card (random cards, kinds taken in turn), so a quiz never asks the same card twice. */
export function buildQuiz(
  cards: Pair[],
  options: {count?: number; kinds?: string} = {},
  random: () => number = Math.random,
): QuizQuestion[] {
  const kinds = options.kinds ? QuizKindSchema.options.filter(kind => options.kinds!.split(',').includes(kind)) : [];
  const turn = shuffle(kinds.length > 0 ? kinds : [...QuizKindSchema.options], random);
  const count = Math.min(options.count ?? QUIZ_DEFAULT_QUESTIONS, cards.length);
  return shuffle(cards, random)
    .slice(0, count)
    .map((card, index) => ask(card, turn[index % turn.length]!, cards, random));
}
