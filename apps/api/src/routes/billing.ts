/**
 * Billing routes.
 *
 *  GET  /api/billing/balance      — current quota snapshot
 *  POST /api/billing/ad-session   — mint a rewarded-ad nonce (Day 6)
 *  POST /api/billing/grant-reward — claim the nonce → +1 rewarded credit
 *
 * Day 6 (ADR-009): grant-reward is now protected by the server-issued
 * nonce lifecycle (user-bound, min-watch-time, daily cap, atomic burn)
 * and therefore WORKS IN PRODUCTION. The old 501 gate is removed —
 * the nonce contour IS the protection. See lib/ad-session.ts.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';

import {
  ERROR_CODES,
  grantRewardSchema,
  type AdSession,
  type ApiResponse,
  type BillingBalance,
} from '@styleme/shared';

import { claimAdSession, issueAdSession } from '../lib/ad-session';
import { getBalance, grantRewarded } from '../lib/quota';
import { HttpError } from '../middleware/error-handler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const billingRouter = Router();

billingRouter.get(
  '/api/billing/balance',
  requireAuth,
  async (req: Request, res: Response<ApiResponse<BillingBalance>>, next: NextFunction) => {
    try {
      const balance = await getBalance(req.user!.id);
      res.json({ success: true, data: balance });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// POST /api/billing/ad-session — start a rewarded-ad session
// ============================================================================

billingRouter.post(
  '/api/billing/ad-session',
  requireAuth,
  async (req: Request, res: Response<ApiResponse<AdSession>>, next: NextFunction) => {
    try {
      const result = await issueAdSession(req.user!.id);
      if (!result.ok) {
        throw new HttpError(
          429,
          ERROR_CODES.AD_CAP_REACHED,
          "You've reached today's ad limit. Come back tomorrow!",
        );
      }
      res.json({
        success: true,
        data: {
          nonce: result.nonce,
          minWatchSeconds: result.minWatchSeconds,
          viewsRemainingToday: result.viewsRemainingToday,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// POST /api/billing/grant-reward — claim a completed session
// ============================================================================

billingRouter.post(
  '/api/billing/grant-reward',
  requireAuth,
  validate(grantRewardSchema),
  async (req: Request, res: Response<ApiResponse<BillingBalance>>, next: NextFunction) => {
    try {
      const { nonce } = req.body as { nonce: string };
      const claim = await claimAdSession(req.user!.id, nonce);

      if (!claim.ok) {
        switch (claim.reason) {
          case 'cap':
            throw new HttpError(
              429,
              ERROR_CODES.AD_CAP_REACHED,
              "You've reached today's ad limit. Come back tomorrow!",
            );
          case 'too-early':
            throw new HttpError(
              400,
              ERROR_CODES.AD_SESSION_INVALID,
              'Please watch the full ad before claiming.',
            );
          case 'invalid':
          default:
            throw new HttpError(
              400,
              ERROR_CODES.AD_SESSION_INVALID,
              'Ad session is invalid or expired. Please try again.',
            );
        }
      }

      const balance = await grantRewarded(req.user!.id, 1);
      res.json({ success: true, data: balance });
    } catch (err) {
      next(err);
    }
  },
);
