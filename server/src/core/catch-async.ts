import {RequestHandler} from 'express';

type AsyncRequestHandler = (...args: Parameters<RequestHandler>) => Promise<unknown>;

export const catchAsync = (handler: AsyncRequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
