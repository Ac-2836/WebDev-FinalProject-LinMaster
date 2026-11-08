import {ErrorRequestHandler} from 'express';
import {AppError} from '../utils/AppError';

export const errorMiddleware: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.statusCode,
        status: error.status,
        message: error.message,
        ...(error.details === undefined ? {} : {details: error.details}),
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      code: 500,
      status: 'INTERNAL',
      message: 'Lỗi máy chủ nội bộ.',
    },
  });
};
