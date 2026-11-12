import {MAX_IMPORT_AUDIO_BYTES, ImportFileIdParamsSchema} from '@linmaster/shared';
import {type RequestHandler, Router} from 'express';
import multer from 'multer';
import {z} from 'zod';

import {AppError} from '../../core/app-error';
import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import type {createImportService} from './imports.service';

type ImportService = ReturnType<typeof createImportService>;
type FileParams = typeof ImportFileIdParamsSchema._output;

// The largest file allowed (audio); the storage driver applies the exact limit of each file type.
const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {fileSize: MAX_IMPORT_AUDIO_BYTES, files: 1, fields: 0, parts: 1},
});

const parseImportFile: RequestHandler = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    next(new AppError('Send the file as multipart/form-data in the "file" field.', 400));
    return;
  }
  upload.single('file')(req, res, error => {
    if (!error && req.file) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('PDF files must be 20 MB or smaller and audio files 60 MB or smaller.', 413));
    }
    next(new AppError('Send exactly one file in the "file" field.', 400));
  });
};

const deleteImportFileSchema = z.object({params: ImportFileIdParamsSchema});

/** Routes of the test import flow (PLAN C4). */
export function addImportRoutes(router: Router, service: ImportService, jwtSecret: string): Router {
  router.post(
    '/tests/imports/files',
    requireAuth(jwtSecret),
    parseImportFile,
    catchAsync(async (req, res) => {
      const file = req.file!;
      const result = await service.uploadFile(req.user!.userId, {
        data: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });
      res.status(201).json(result);
    }),
  );
  router.delete(
    '/tests/imports/files/:fileId',
    requireAuth(jwtSecret),
    validate(deleteImportFileSchema),
    catchAsync(async (req, res) => {
      res.json(await service.deleteFile(req.user!.userId, (req.params as FileParams).fileId));
    }),
  );
  return router;
}
