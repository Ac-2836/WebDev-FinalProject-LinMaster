import {Router} from 'express';
import type {
  CreatePastedDocumentRequestSchema,
  CreateUploadedDocumentFieldsSchema,
  ListVocabEntriesQuery,
  SaveVocabEntriesRequestSchema,
  UpdateVocabEntryRequestSchema,
  VocabEntryIdParamsSchema,
} from '@linmaster/shared';
import {AppError} from '../../core/app-error';
import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import {parseDocumentUpload} from './document-upload.middleware';
import type {createVocabDocumentService} from './documents.service';
import type {UploadedDocument} from './document-parser';
import type {createVocabService} from './vocab.service';
import {
  deleteVocabEntrySchema,
  createVocabDocumentSchema,
  getVocabEntrySchema,
  listVocabEntriesSchema,
  saveVocabEntriesSchema,
  updateVocabEntrySchema,
  vocabDocumentParamsSchema,
} from './vocab.schema';

type VocabService = ReturnType<typeof createVocabService>;
type SaveEntriesRequest = typeof SaveVocabEntriesRequestSchema._output;
type UpdateEntryRequest = typeof UpdateVocabEntryRequestSchema._output;
type EntryParams = typeof VocabEntryIdParamsSchema._output;
type CreateDocumentBody =
  typeof CreatePastedDocumentRequestSchema._output | typeof CreateUploadedDocumentFieldsSchema._output;

export function createVocabRouter(
  service: VocabService,
  documentService: ReturnType<typeof createVocabDocumentService>,
  jwtSecret: string,
): Router {
  const router = Router();

  router.post(
    '/vocab/documents',
    requireAuth(jwtSecret),
    parseDocumentUpload,
    validate(createVocabDocumentSchema),
    catchAsync(async (req, res) => {
      const body = req.body as CreateDocumentBody;
      if (req.file) {
        const file: UploadedDocument = {
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        };
        res
          .status(201)
          .json(
            await documentService.createUploadedDocument(
              req.user!.userId,
              file,
              'title' in body ? body.title : undefined,
            ),
          );
        return;
      }
      if ('text' in body) {
        res.status(201).json(await documentService.createPastedDocument(req.user!.userId, body));
        return;
      }
      throw new AppError('Upload a file using the "file" form field.', 400);
    }),
  );
  router.get(
    '/vocab/documents',
    requireAuth(jwtSecret),
    catchAsync(async (req, res) => {
      res.json(await documentService.listDocuments(req.user!.userId));
    }),
  );
  router.get(
    '/vocab/documents/:id',
    requireAuth(jwtSecret),
    validate(vocabDocumentParamsSchema),
    catchAsync(async (req, res) => {
      res.json(await documentService.getDocument(req.user!.userId, (req.params as {id: string}).id));
    }),
  );
  router.delete(
    '/vocab/documents/:id',
    requireAuth(jwtSecret),
    validate(vocabDocumentParamsSchema),
    catchAsync(async (req, res) => {
      res.json(await documentService.deleteDocument(req.user!.userId, (req.params as {id: string}).id));
    }),
  );

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
