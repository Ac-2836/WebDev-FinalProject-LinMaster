import multer from 'multer';
import type {RequestHandler} from 'express';
import {AppError} from '../../core/app-error';
import {MAX_DOCUMENT_FILE_BYTES} from './document-parser';

const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {fileSize: MAX_DOCUMENT_FILE_BYTES, files: 1, fields: 1, parts: 2, fieldSize: 1024},
});

export const parseDocumentUpload: RequestHandler = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    next();
    return;
  }

  upload.single('file')(req, res, error => {
    if (!error) {
      next();
      return;
    }

    const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    next(new AppError(status === 413 ? 'Document files must be 5 MB or smaller.' : 'Invalid document upload.', status));
  });
};
