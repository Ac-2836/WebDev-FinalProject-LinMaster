import {RequestHandler} from 'express';
import {AppError} from './app-error';
import {verifyJwt} from './jwt';

export const requireAuth =
  (secret: string): RequestHandler =>
  (req, _res, next) => {
    const authorization = req.header('authorization');
    const match = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      next(new AppError('Authentication required.', 401));
      return;
    }

    try {
      req.user = verifyJwt(match[1], secret);
      next();
    } catch {
      next(new AppError('Invalid or expired authentication token.', 401));
    }
  };
