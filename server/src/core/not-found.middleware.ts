import {RequestHandler} from 'express';
import {AppError} from './app-error';

export const notFoundMiddleware: RequestHandler = (_req, _res, next) => {
  next(new AppError('Resource not found.', 404));
};
