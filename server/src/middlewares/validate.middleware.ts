import { RequestHandler } from 'express';
import { ZodError, ZodType } from 'zod';
import { AppError } from '../utils/AppError';

type RequestParts = {
  body: unknown;
  query: unknown;
  params: unknown;
};

export const validate = (schema: ZodType): RequestHandler => {
  return async (req, _res, next) => {
    try {
      const requestParts: RequestParts = {
        body: req.body,
        query: req.query,
        params: req.params,
      };

      await schema.parseAsync(requestParts);
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        next(
          new AppError(
            'Dữ liệu đầu vào không hợp lệ.',
            400,
            details,
          ),
        );
        return;
      }

      next(error);
    }
  };
};