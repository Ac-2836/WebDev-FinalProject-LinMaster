import {Router} from 'express';
import type {
  CreateFlashcardSetFromVocabSchema,
  CreateFlashcardSetSchema,
  FlashcardSetIdParamsSchema,
  ReplaceFlashcardCardsRequestSchema,
  UpdateFlashcardSetSchema,
} from '@linmaster/shared';
import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import type {createFlashcardService} from './flashcard.service';
import {
  createFlashcardSetFromVocabSchema,
  createFlashcardSetSchema,
  deleteFlashcardSetSchema,
  getFlashcardSetSchema,
  listFlashcardSetsSchema,
  replaceFlashcardCardsSchema,
  updateFlashcardSetSchema,
} from './flashcard.schema';

type FlashcardService = ReturnType<typeof createFlashcardService>;
type SetParams = typeof FlashcardSetIdParamsSchema._output;
type CreateSetInput = typeof CreateFlashcardSetSchema._output;
type CreateFromVocabInput = typeof CreateFlashcardSetFromVocabSchema._output;
type UpdateSetInput = typeof UpdateFlashcardSetSchema._output;
type ReplaceCardsInput = typeof ReplaceFlashcardCardsRequestSchema._output;

export function createFlashcardRouter(service: FlashcardService, jwtSecret: string): Router {
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

  return router;
}
