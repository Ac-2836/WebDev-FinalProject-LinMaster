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

/**
 * Other cards' definitions that cannot also be right: not the card's own meaning, and not from a card with the same
 * term (a second sense of the word, such as "bank"), so a question never has two correct options.
 */
function distractors(card: Pair, cards: Pair[], random: () => number): string[] {
  const seen = new Set([norm(card.definition)]);
  const out: string[] = [];
  for (const other of shuffle(cards, random)) {
    if (other.id === card.id || norm(other.term) === norm(card.term) || seen.has(norm(other.definition))) continue;
    seen.add(norm(other.definition));
    out.push(other.definition);
  }
  return out;
}

/** The kind asked, else another that has one right answer for this card; null when none does. */
function ask(card: Pair, preferred: QuizKind, cards: Pair[], random: () => number): QuizQuestion | null {
  const wrong = distractors(card, cards, random);
  // A definition shared with a card of another term accepts several typed answers, so it cannot be asked as `written`.
  const typable = !cards.some(c => norm(c.definition) === norm(card.definition) && norm(c.term) !== norm(card.term));
  const feasible: Record<QuizKind, boolean> = {
    'multiple-choice': wrong.length >= QUIZ_CHOICES - 1,
    'true-false': wrong.length > 0,
    written: typable,
  };
  const kind = [preferred, ...QuizKindSchema.options].find(k => feasible[k]);
  if (kind === 'multiple-choice') {
    const options = shuffle([card.definition, ...wrong.slice(0, QUIZ_CHOICES - 1)], random);
    return {kind, cardId: card.id, prompt: card.term, options, answer: card.definition};
  }
  if (kind === 'true-false') {
    const isTrue = random() < 0.5;
    return {kind, cardId: card.id, prompt: card.term, statement: isTrue ? card.definition : wrong[0]!, answer: isTrue};
  }
  if (kind === 'written') return {kind, cardId: card.id, prompt: card.definition, answer: card.term};
  return null;
}

/** One question per card (random cards, kinds taken in turn); a card with no unambiguous question is skipped. */
export function buildQuiz(
  cards: Pair[],
  options: {count?: number; kinds?: string} = {},
  random: () => number = Math.random,
): QuizQuestion[] {
  const kinds = options.kinds ? QuizKindSchema.options.filter(kind => options.kinds!.split(',').includes(kind)) : [];
  const turn = shuffle(kinds.length > 0 ? kinds : [...QuizKindSchema.options], random);
  const count = Math.min(options.count ?? QUIZ_DEFAULT_QUESTIONS, cards.length);
  const questions: QuizQuestion[] = [];
  for (const card of shuffle(cards, random)) {
    if (questions.length === count) break;
    const question = ask(card, turn[questions.length % turn.length]!, cards, random);
    if (question) questions.push(question);
  }
  return questions;
}
