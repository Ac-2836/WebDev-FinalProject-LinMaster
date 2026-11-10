import {Router} from 'express';
import type {
  ListVocabEntriesQuery,
  SaveVocabEntriesRequestSchema,
  UpdateVocabEntryRequestSchema,
  VocabEntryIdParamsSchema,
} from '@linmaster/shared';
import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import type {createVocabService} from './vocab.service';
import {
  deleteVocabEntrySchema,
  getVocabEntrySchema,
  listVocabEntriesSchema,
  saveVocabEntriesSchema,
  updateVocabEntrySchema,
} from './vocab.schema';

type VocabService = ReturnType<typeof createVocabService>;
type SaveEntriesRequest = typeof SaveVocabEntriesRequestSchema._output;
type UpdateEntryRequest = typeof UpdateVocabEntryRequestSchema._output;
type EntryParams = typeof VocabEntryIdParamsSchema._output;

export function createVocabRouter(service: VocabService, jwtSecret: string): Router {
  const router = Router();

  router.post(
    '/vocab/entries',
    requireAuth(jwtSecret),
    validate(saveVocabEntriesSchema),
    catchAsync(async (req, res) => {
      const result = await service.saveEntries(req.user!.userId, (req.body as SaveEntriesRequest).entries);
      res.status(201).json(result);
    }),
  );
  router.get(
    '/vocab/entries',
    requireAuth(jwtSecret),
    validate(listVocabEntriesSchema),
    catchAsync(async (req, res) => {
      res.json(await service.listEntries(req.user!.userId, req.query as unknown as ListVocabEntriesQuery));
    }),
  );
  router.get(
    '/vocab/entries/:id',
    requireAuth(jwtSecret),
    validate(getVocabEntrySchema),
    catchAsync(async (req, res) => {
      res.json(await service.getEntry(req.user!.userId, (req.params as EntryParams).id));
    }),
  );
  router.patch(
    '/vocab/entries/:id',
    requireAuth(jwtSecret),
    validate(updateVocabEntrySchema),
    catchAsync(async (req, res) => {
      res.json(
        await service.updateNote(
          req.user!.userId,
          (req.params as EntryParams).id,
          (req.body as UpdateEntryRequest).note,
        ),
      );
    }),
  );
  router.delete(
    '/vocab/entries/:id',
    requireAuth(jwtSecret),
    validate(deleteVocabEntrySchema),
    catchAsync(async (req, res) => {
      res.json(await service.deleteEntry(req.user!.userId, (req.params as EntryParams).id));
    }),
  );

  return router;
}
