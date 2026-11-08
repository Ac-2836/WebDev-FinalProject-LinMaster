import {ErrorRequestHandler} from 'express';
import {AppError} from './app-error';

function getBodyParserErrorType(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    return undefined;
  }

  return typeof error.type === 'string' ? error.type : undefined;
}

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

  const bodyParserErrorType = getBodyParserErrorType(error);
  if (bodyParserErrorType === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: 'Request body is not valid JSON.',
      },
    });
    return;
  }

  if (bodyParserErrorType === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: 413,
        status: 'INVALID_ARGUMENT',
        message: 'Request body is too large.',
      },
    });
    return;
  }

  console.error('Unhandled server error:', error);
  res.status(500).json({
    error: {
      code: 500,
      status: 'INTERNAL',
      message: 'Lỗi máy chủ nội bộ.',
    },
  });
};
