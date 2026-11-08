import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { errorMiddleware } from '../../src/middlewares/error.middleware';
import { validate } from '../../src/middlewares/validate.middleware';
import { AppError } from '../../src/utils/AppError';
import { catchAsync } from '../../src/utils/catchAsync';

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
      res.status(200).json({ ok: true });
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

  app.use(errorMiddleware);

  return app;
}

describe('error handling', () => {
  it('trả lỗi 400 chuẩn khi request không hợp lệ theo Zod', async () => {
    const response = await request(createTestApp())
      .post('/validation-test')
      .send({ email: 'khong-phai-email' });

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
    const response = await request(createTestApp())
      .get('/unexpected-error-test');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 500,
        status: 'INTERNAL',
        message: 'Lỗi máy chủ nội bộ.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'secret database detail',
    );
  });

  it('trả đúng response cho AppError', async () => {
    const response = await request(createTestApp())
      .get('/app-error-test');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 404,
        status: 'NOT_FOUND',
        message: 'Không tìm thấy tài nguyên.',
      },
    });
  });
});