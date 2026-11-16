import type {Rating, StudyCard} from '@linmaster/shared';

/** A Learn session: cards still to rate, plus how each rating was used. SM-2 itself runs on the server. */
export interface LearnQueue {
  queue: StudyCard[];
  done: number;
  tally: Record<Rating, number>;
}

export const startQueue = (cards: StudyCard[]): LearnQueue => ({
  queue: cards,
  done: 0,
  tally: {again: 0, hard: 0, good: 0, easy: 0},
});

/**
 * After rating the front card: "again" sends it to the back to be seen once more this session
 * (like the learning step of SM-2 apps); any other rating finishes it. A card rated "again" is no longer new or
 * mastered: it comes back as learning (st-04, QA T8).
 */
export function rate({queue, done, tally}: LearnQueue, rating: Rating): LearnQueue {
  const [card, ...rest] = queue;
  if (!card) return {queue, done, tally};
  const again = rating === 'again';
  return {
    queue: again ? [...rest, {...card, state: 'learning'}] : rest,
    done: again ? done : done + 1,
    tally: {...tally, [rating]: tally[rating] + 1},
  };
}

export const RATING_KEYS: Record<string, Rating> = {'1': 'again', '2': 'hard', '3': 'good', '4': 'easy'};
