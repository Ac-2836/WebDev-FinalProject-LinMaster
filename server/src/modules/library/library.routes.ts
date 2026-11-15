import {LibraryIdParamsSchema, type LibraryQuery, LibraryQuerySchema, type LibraryType} from '@linmaster/shared';
import {Router} from 'express';
import {z} from 'zod';

import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import type {LibraryService} from './library.service';

const browseRequest = z.object({query: LibraryQuerySchema});
const idRequest = z.object({params: LibraryIdParamsSchema});
const PATHS: Record<LibraryType, string> = {set: 'sets', test: 'tests'};

const idOf = (params: unknown) => (params as z.infer<typeof LibraryIdParamsSchema>).id;

/** `/library/*` (PLAN C5): every route needs a signed-in user; only `public` content is listed or previewed. */
export function createLibraryRouter(service: LibraryService, jwtSecret: string): Router {
  const router = Router();
  const auth = requireAuth(jwtSecret);

  router.get(
    '/library',
    auth,
    validate(browseRequest),
    catchAsync(async (req, res) => res.json(await service.browse(req.query as unknown as LibraryQuery))),
  );
  for (const type of ['set', 'test'] as const) {
    for (const action of ['publish', 'unpublish'] as const) {
      router.post(
        `/library/${PATHS[type]}/:id/${action}`,
        auth,
        validate(idRequest),
        catchAsync(async (req, res) =>
          res.json(await service.setVisibility(req.user!.userId, type, idOf(req.params), action)),
        ),
      );
    }
  }
  router.get(
    '/library/sets/:id',
    auth,
    validate(idRequest),
    catchAsync(async (req, res) => res.json(await service.previewSet(req.user!.userId, idOf(req.params)))),
  );
  router.get(
    '/library/tests/:id',
    auth,
    validate(idRequest),
    catchAsync(async (req, res) => res.json(await service.previewTest(req.user!.userId, idOf(req.params)))),
  );
  return router;
}
