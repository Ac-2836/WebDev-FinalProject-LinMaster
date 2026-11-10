import {
  cardStateOf,
  MAX_DUE_CARDS_PER_STUDY,
  NEW_CARDS_PER_DAY,
  type CardProgress,
  type DueSummaryResponse,
  type EndStudySessionRequest,
  type GetStudyCardsResponse,
  type ReviewCardRequest,
  type StartStudySessionRequest,
  type StudySession,
} from '@linmaster/shared';
// Same Vietnam-day boundaries as the AI quota (data dictionary: "per day" means UTC+7).
import {vietnamDayBounds} from '../../core/ai/ai-gateway';
import {AppError} from '../../core/app-error';
import {scheduleReview} from './flashcard.scheduler';
import type {ProgressRecord, SessionRecord, StudyRepository} from './study.repository';

function toProgressDto(progress: ProgressRecord): CardProgress {
  return {
    cardId: progress.cardId,
    easiness: progress.easiness,
    intervalDays: progress.intervalDays,
    repetitions: progress.repetitions,
    lapses: progress.lapses,
    dueAt: progress.dueAt.toISOString(),
    lastReviewedAt: progress.lastReviewedAt?.toISOString() ?? null,
    state: cardStateOf(progress),
  };
}

function toSessionDto(session: SessionRecord): StudySession {
  return {
    id: session.id,
    setId: session.setId,
    mode: session.mode,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    cardsStudied: session.cardsStudied,
    correctCount: session.correctCount,
  };
}

const setNotFound = () => new AppError('Flashcard set not found.', 404);
const sessionNotFound = () => new AppError('Study session not found.', 404);
const sessionEnded = () => new AppError('Study session has already ended.', 409);

/** `now` is injectable so tests can fix the clock around the Vietnam midnight. */
export function createStudyService(repository: StudyRepository, now: () => Date = () => new Date()) {
  return {
    /** Due cards plus today's allowance of new cards (PLAN C3, act-04). */
    async getStudyCards(userId: string, setId: string): Promise<GetStudyCardsResponse> {
      if (!(await repository.isSetOwner(userId, setId))) throw setNotFound();

      const {start, end} = vietnamDayBounds(now());
      const due = await repository.listDueCards(userId, setId, end, MAX_DUE_CARDS_PER_STUDY);
      const started = await repository.countNewCardsStarted(userId, setId, start, end);
      const allowance = Math.max(0, NEW_CARDS_PER_DAY - started);
      const fresh = await repository.listNewCards(userId, setId, allowance);

      return {
        setId,
        cards: [
          ...due.map(({card, progress}) => ({
            ...card,
            state: cardStateOf(progress),
            progress: progress && toProgressDto(progress),
          })),
          ...fresh.map(card => ({...card, state: 'new' as const, progress: null})),
        ],
        dueCount: due.length,
        newCount: fresh.length,
        newCardsPerDay: NEW_CARDS_PER_DAY,
        newCardsRemaining: allowance - fresh.length,
      };
    },

    /** Rates one card, updates SM-2 progress and writes the ReviewLog (seq-08). */
    async review(userId: string, {cardId, rating, sessionId}: ReviewCardRequest) {
      const cardSetId = await repository.findCardSetId(userId, cardId);
      if (!cardSetId) throw new AppError('Flashcard not found.', 404);

      if (sessionId) {
        const session = await repository.findSession(userId, sessionId);
        if (!session) throw sessionNotFound();
        if (session.endedAt) throw sessionEnded();
        // Flip, test and match never change SM-2 progress (UC24, UC26).
        if (session.mode !== 'learn') throw new AppError('Only learn sessions record ratings.', 409);
        if (session.setId !== cardSetId) throw new AppError('The card is not in the set of this session.', 400);
      }

      const reviewedAt = now();
      const progress = await repository.reviewCard(userId, cardId, {
        rating,
        sessionId: sessionId ?? null,
        now: reviewedAt,
        schedule: previous => scheduleReview(previous, rating, reviewedAt),
      });
      return {progress: toProgressDto(progress)};
    },

    async startSession(userId: string, {setId, mode}: StartStudySessionRequest) {
      if (!(await repository.isSetOwner(userId, setId))) throw setNotFound();
      return {session: toSessionDto(await repository.createSession(userId, setId, mode, now()))};
    },

    /** Closes a session. Learn sessions count from their ReviewLog; other modes use the counts the client sends. */
    async endSession(userId: string, id: string, input: EndStudySessionRequest) {
      const session = await repository.findSession(userId, id);
      if (!session) throw sessionNotFound();
      if (session.endedAt) throw sessionEnded();

      let counts: {cardsStudied: number; correctCount: number};
      if (session.mode === 'learn') {
        const reviews = await repository.listSessionReviews(session.id);
        const studied = new Set(reviews.map(review => review.cardId));
        // A card rated Again and then recalled later in the same session still counts as correct.
        const recalled = new Set(reviews.filter(review => review.rating !== 'again').map(review => review.cardId));
        counts = {cardsStudied: studied.size, correctCount: recalled.size};
      } else {
        const cardsStudied = input.cardsStudied ?? 0;
        counts = {cardsStudied, correctCount: Math.min(input.correctCount ?? 0, cardsStudied)};
      }

      const ended = await repository.endSession(userId, id, counts, now());
      if (!ended) throw sessionEnded();
      return {session: toSessionDto(ended)};
    },

    /** Cards due today across all sets, for the home page (P2-09). */
    async dueSummary(userId: string): Promise<DueSummaryResponse> {
      const {end} = vietnamDayBounds(now());
      const sets = (await repository.dueSetCounts(userId, end)).sort(
        (a, b) => b.dueCount - a.dueCount || a.title.localeCompare(b.title),
      );
      return {dueCount: sets.reduce((total, set) => total + set.dueCount, 0), sets};
    },
  };
}
