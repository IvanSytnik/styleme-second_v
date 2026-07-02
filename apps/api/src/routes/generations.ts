/**
 * Generations routes.
 *
 *   GET    /api/generations          — cursor-paginated feed
 *   DELETE /api/generations/:id      — soft delete
 *
 * Auth-required. Users only see their own rows (enforced at both the
 * DB query level and via RLS).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';

import {
  ERROR_CODES,
  listGenerationsQuerySchema,
  type ApiResponse,
  type GenerationListPage,
} from '@styleme/shared';

import { listGenerations, softDeleteGeneration } from '../db/generations';
import { HttpError } from '../middleware/error-handler';
import { requireAuth } from '../middleware/auth';

export const generationsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// GET /api/generations
// ============================================================================

generationsRouter.get(
  '/api/generations',
  requireAuth,
  async (
    req: Request,
    res: Response<ApiResponse<GenerationListPage>>,
    next: NextFunction,
  ) => {
    try {
      const parsed = listGenerationsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new HttpError(
          400,
          ERROR_CODES.VALIDATION_FAILED,
          parsed.error.issues[0]?.message ?? 'Invalid query',
        );
      }

      const { items, nextCursor } = await listGenerations({
        userId: req.user!.id,
        cursor: parsed.data.cursor,
        limit: parsed.data.limit,
      });

      res.json({ success: true, data: { items, nextCursor } });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// DELETE /api/generations/:id
// ============================================================================

generationsRouter.delete(
  '/api/generations/:id',
  requireAuth,
  async (req: Request, res: Response<ApiResponse<{ deleted: true }>>, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (!id || !UUID_RE.test(id)) {
        throw new HttpError(
          400,
          ERROR_CODES.VALIDATION_FAILED,
          'Invalid generation id',
        );
      }

      const ok = await softDeleteGeneration(req.user!.id, id);
      if (!ok) {
        // Either the row doesn't exist, was already deleted, or belongs to
        // another user. All three are indistinguishable to a caller — 404.
        throw new HttpError(404, 'NOT_FOUND', 'Generation not found');
      }

      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  },
);
