import {RequestHandler} from 'express';
import {ZodError, ZodType} from 'zod';
import {AppError} from './app-error';

interface RequestParts {
  body: unknown;
  query: unknown;
  params: unknown;
}

function isRequestParts(value: unknown): value is Partial<RequestParts> {
  return typeof value === 'object' && value !== null;
}

export const validate = (schema: ZodType): RequestHandler => {
  return async (req, _res, next) => {
    try {
      const requestParts: RequestParts = {
        body: req.body,
        query: req.query,
        params: req.params,
      };

      const parsed = await schema.parseAsync(requestParts);
      if (!isRequestParts(parsed)) {
        throw new Error('Request validation schema must return an object.');
      }

      if ('body' in parsed) {
        req.body = parsed.body;
      }

      if ('query' in parsed) {
        Object.defineProperty(req, 'query', {
          configurable: true,
          enumerable: true,
          value: parsed.query,
          writable: true,
        });
      }

      if ('params' in parsed) {
        Object.defineProperty(req, 'params', {
          configurable: true,
          enumerable: true,
          value: parsed.params,
          writable: true,
        });
      }

      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const details = error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        next(new AppError('Dữ liệu đầu vào không hợp lệ.', 400, details));
        return;
      }

      next(error);
    }
  };
};
