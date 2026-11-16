import type {RequestHandler} from 'express';
import {rateLimit} from 'express-rate-limit';

export interface UserRateLimit {
  windowMs: number;
  limit: number;
  /** Shown in the 429 body, e.g. "Too many uploads." */
  message: string;
}

/**
 * Limit per signed-in user, for costly routes such as uploads (P5-02): the API-wide limit counts per IP only, so one
 * account could still fill the server memory and the storage. Put it after `requireAuth`.
 */
export function userRateLimit({windowMs, limit, message}: UserRateLimit): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: req => req.user!.userId,
    handler: (_req, res) => {
      res.status(429).json({error: {code: 429, status: 'RESOURCE_EXHAUSTED', message}});
    },
  });
}

/** Uploads per user per hour: a full test needs at most 10 files, so this leaves room for a few retries. */
export const UPLOADS_PER_HOUR = 30;
export const uploadRateLimit = () =>
  userRateLimit({
    windowMs: 60 * 60 * 1000,
    limit: UPLOADS_PER_HOUR,
    message: 'Too many uploads. Please try again later.',
  });

/**
 * AI calls per user per minute (lookups, scans, test imports), on top of the daily AI quota: stops a script from
 * spending the whole quota, and the shared Gemini free tier, in a few seconds.
 */
export const AI_CALLS_PER_MINUTE = 20;
export const aiRateLimit = () =>
  userRateLimit({
    windowMs: 60 * 1000,
    limit: AI_CALLS_PER_MINUTE,
    message: 'Too many AI requests. Please wait a minute.',
  });
