import express from 'express';
import request from 'supertest';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {z} from 'zod';

import {createApp} from '../../src/app';
import {AppError} from '../../src/core/app-error';
import {catchAsync} from '../../src/core/catch-async';
import {errorMiddleware} from '../../src/core/error.middleware';
import {validate} from '../../src/core/validate.middleware';

afterEach(() => {
  vi.restoreAllMocks();
});

function createTestApp() {
  const app = express();

  app.use(express.json());

  app.post(
    '/validation-test',
    validate(
      z.object({
        body: z.object({
          email: z.string().email(),
        }),
        query: z.object({}),
        params: z.object({}),
      }),
    ),
    (_req, res) => {
      res.status(200).json({ok: true});
    },
  );

  app.get(
    '/unexpected-error-test',
    catchAsync(async () => {
      throw new Error('secret database detail');
    }),
  );

  app.get('/app-error-test', (_req, _res, next) => {
    next(new AppError('Không tìm thấy tài nguyên.', 404));
  });

  app.get('/already-exists-error-test', (_req, _res, next) => {
    next(new AppError('Email already exists.', 409, undefined, 'ALREADY_EXISTS'));
  });

  app.get('/unprocessable-error-test', (_req, _res, next) => {
    next(new AppError('Unprocessable request.', 422));
  });

  app.get('/coerced-query-test', validate(z.object({query: z.object({page: z.coerce.number()})})), (req, res) => {
    res.json({page: req.query.page});
  });

  app.use(errorMiddleware);

  return app;
}

describe('error handling', () => {
  it('trả lỗi 400 chuẩn khi request không hợp lệ theo Zod', async () => {
    const response = await request(createTestApp()).post('/validation-test').send({email: 'khong-phai-email'});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: 'Dữ liệu đầu vào không hợp lệ.',
      },
    });
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'body.email',
        }),
      ]),
    );
  });

  it('trả lỗi 500 chung và không để lộ lỗi nội bộ', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await request(createTestApp()).get('/unexpected-error-test');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 500,
        status: 'INTERNAL',
        message: 'Lỗi máy chủ nội bộ.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('secret database detail');
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('trả đúng response cho AppError', async () => {
    const response = await request(createTestApp()).get('/app-error-test');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 404,
        status: 'NOT_FOUND',
        message: 'Không tìm thấy tài nguyên.',
      },
    });
  });

  it('supports AppError status overrides and 422 mapping', async () => {
    const app = createTestApp();
    const alreadyExists = await request(app).get('/already-exists-error-test');
    const unprocessable = await request(app).get('/unprocessable-error-test');

    expect(alreadyExists.status).toBe(409);
    expect(alreadyExists.body.error.status).toBe('ALREADY_EXISTS');
    expect(unprocessable.status).toBe(422);
    expect(unprocessable.body.error.status).toBe('FAILED_PRECONDITION');
  });

  it('passes transformed query data to the route handler', async () => {
    const response = await request(createTestApp()).get('/coerced-query-test?page=12');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({page: 12});
  });

  it('returns 400 for malformed JSON through the real app', async () => {
    const response = await request(createApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"a":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: 'Request body is not valid JSON.',
      },
    });
  });

  it('returns 413 for an oversized JSON body through the real app', async () => {
    const body = JSON.stringify({payload: 'x'.repeat(200 * 1024)});
    const response = await request(createApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: {
        code: 413,
        status: 'INVALID_ARGUMENT',
        message: 'Request body is too large.',
      },
    });
  });

  it('returns a JSON 404 for an unknown API route', async () => {
    const response = await request(createApp()).get('/api/v1/khong-co');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: 404,
      status: 'NOT_FOUND',
    });
  });
});
