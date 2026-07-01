/**
 * Billing routes.
 *
 *  GET  /api/billing/balance     — current quota snapshot
 *  POST /api/billing/grant-reward — grant +1 rewarded credit
 *
 * The grant endpoint is the critical security point: in production it
 * MUST verify the ad-network signature before granting. Right now we
 * accept any non-empty token in development, and return 501 in
 * production — so it cannot be abused before Day 6 lands real verification.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';

import {
  ERROR_CODES,
  grantRewardSchema,
  type ApiResponse,
  type BillingBalance,
} from '@styleme/shared';

import { isProd } from '../env';
import { getBalance, grantRewarded } from '../lib/quota';
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

billingRouter.post(
  '/api/billing/grant-reward',
  requireAuth,
  validate(grantRewardSchema),
  async (req: Request, res: Response<ApiResponse<BillingBalance>>, next: NextFunction) => {
    try {
      if (isProd) {
        // Day 6 will implement real signature verification here.
        res.status(501).json({
          success: false,
          error: {
            code: ERROR_CODES.NOT_IMPLEMENTED,
            message: 'Ad-network verification is not yet enabled in production',
          },
        });
        return;
      }
      // Dev-only: any non-empty token grants +1. Schema already enforced non-empty.
      const balance = await grantRewarded(req.user!.id, 1);
      res.json({ success: true, data: balance });
    } catch (err) {
      next(err);
    }
  },
);
