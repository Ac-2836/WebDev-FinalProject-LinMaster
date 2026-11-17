import {Router} from 'express';
import type {
  CreateFlashcardSetFromVocabSchema,
  CreateFlashcardSetSchema,
  EndStudySessionRequestSchema,
  FlashcardSetIdParamsSchema,
  GenerateExerciseRequestSchema,
  QuizQuerySchema,
  ReplaceFlashcardCardsRequestSchema,
  ReviewCardRequestSchema,
  StartStudySessionRequestSchema,
  StudySessionIdParamsSchema,
  UpdateFlashcardSetSchema,
} from '@linmaster/shared';
import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {aiRateLimit} from '../../core/user-rate-limit';
import {validate} from '../../core/validate.middleware';
import type {createFlashcardService} from './flashcard.service';
import {
  createFlashcardSetFromVocabSchema,
  createFlashcardSetSchema,
  deleteFlashcardSetSchema,
  dueSummarySchema,
  endStudySessionSchema,
  getFlashcardSetSchema,
  generateExerciseSchema,
  getQuizSchema,
  getStudyCardsSchema,
  listFlashcardSetsSchema,
  replaceFlashcardCardsSchema,
  reviewCardSchema,
  startStudySessionSchema,
  updateFlashcardSetSchema,
} from './flashcard.schema';
import type {createStudyService} from './study.service';

type FlashcardService = ReturnType<typeof createFlashcardService>;
type StudyService = ReturnType<typeof createStudyService>;
type SessionParams = typeof StudySessionIdParamsSchema._output;
type ReviewInput = typeof ReviewCardRequestSchema._output;
type StartSessionInput = typeof StartStudySessionRequestSchema._output;
type EndSessionInput = typeof EndStudySessionRequestSchema._output;
type SetParams = typeof FlashcardSetIdParamsSchema._output;
type CreateSetInput = typeof CreateFlashcardSetSchema._output;
type CreateFromVocabInput = typeof CreateFlashcardSetFromVocabSchema._output;
type ExerciseInput = typeof GenerateExerciseRequestSchema._output;
type QuizInput = typeof QuizQuerySchema._output;
type UpdateSetInput = typeof UpdateFlashcardSetSchema._output;
type ReplaceCardsInput = typeof ReplaceFlashcardCardsRequestSchema._output;

export function createFlashcardRouter(service: FlashcardService, study: StudyService, jwtSecret: string): Router {
  const router = Router();

  router.post(
    '/flashcards/sets/from-vocab',
    requireAuth(jwtSecret),
    validate(createFlashcardSetFromVocabSchema),
    catchAsync(async (req, res) => {
      const result = await service.createSetFromVocab(req.user!.userId, req.body as CreateFromVocabInput);
      res.status(201).json(result);
    }),
  );
  router.post(
    '/flashcards/sets',
    requireAuth(jwtSecret),
    validate(createFlashcardSetSchema),
    catchAsync(async (req, res) => {
      const result = await service.createSet(req.user!.userId, req.body as CreateSetInput);
      res.status(201).json(result);
    }),
  );
  router.get(
    '/flashcards/sets',
    requireAuth(jwtSecret),
    validate(listFlashcardSetsSchema),
    catchAsync(async (req, res) => {
      res.json(await service.listSets(req.user!.userId));
    }),
  );
  router.get(
    '/flashcards/sets/:id',
    requireAuth(jwtSecret),
    validate(getFlashcardSetSchema),
    catchAsync(async (req, res) => {
      res.json(await service.getSet(req.user!.userId, (req.params as SetParams).id));
    }),
  );
  router.get(
    '/flashcards/sets/:id/quiz',
    requireAuth(jwtSecret),
    validate(getQuizSchema),
    catchAsync(async (req, res) => {
      res.json(await service.getQuiz(req.user!.userId, (req.params as SetParams).id, req.query as QuizInput));
    }),
  );
  router.post(
    '/flashcards/sets/:id/exercises',
    requireAuth(jwtSecret),
    aiRateLimit(),
    validate(generateExerciseSchema),
    catchAsync(async (req, res) => {
      res.json(
        await service.generateExercise(req.user!.userId, (req.params as SetParams).id, req.body as ExerciseInput),
      );
    }),
  );
  router.patch(
    '/flashcards/sets/:id',
    requireAuth(jwtSecret),
    validate(updateFlashcardSetSchema),
    catchAsync(async (req, res) => {
      res.json(await service.updateSet(req.user!.userId, (req.params as SetParams).id, req.body as UpdateSetInput));
    }),
  );
  router.delete(
    '/flashcards/sets/:id',
    requireAuth(jwtSecret),
    validate(deleteFlashcardSetSchema),
    catchAsync(async (req, res) => {
      res.json(await service.deleteSet(req.user!.userId, (req.params as SetParams).id));
    }),
  );
  router.put(
    '/flashcards/sets/:id/cards',
    requireAuth(jwtSecret),
    validate(replaceFlashcardCardsSchema),
    catchAsync(async (req, res) => {
      res.json(
        await service.replaceCards(
          req.user!.userId,
          (req.params as SetParams).id,
          (req.body as ReplaceCardsInput).cards,
        ),
      );
    }),
  );
  router.get(
    '/flashcards/sets/:id/study',
    requireAuth(jwtSecret),
    validate(getStudyCardsSchema),
    catchAsync(async (req, res) => {
      res.json(await study.getStudyCards(req.user!.userId, (req.params as SetParams).id));
    }),
  );
  router.post(
    '/flashcards/reviews',
    requireAuth(jwtSecret),
    validate(reviewCardSchema),
    catchAsync(async (req, res) => {
      res.json(await study.review(req.user!.userId, req.body as ReviewInput));
    }),
  );
  router.post(
    '/flashcards/sessions',
    requireAuth(jwtSecret),
    validate(startStudySessionSchema),
    catchAsync(async (req, res) => {
      res.status(201).json(await study.startSession(req.user!.userId, req.body as StartSessionInput));
    }),
  );
  router.patch(
    '/flashcards/sessions/:id',
    requireAuth(jwtSecret),
    validate(endStudySessionSchema),
    catchAsync(async (req, res) => {
      res.json(await study.endSession(req.user!.userId, (req.params as SessionParams).id, req.body as EndSessionInput));
    }),
  );
  router.get(
    '/flashcards/due-summary',
    requireAuth(jwtSecret),
    validate(dueSummarySchema),
    catchAsync(async (req, res) => {
      res.json(await study.dueSummary(req.user!.userId));
    }),
  );

  return router;
}
