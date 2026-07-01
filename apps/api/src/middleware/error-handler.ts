/**
 * Centralized error handler.
 *
 * Converts any thrown error into the shared ApiResponse envelope.
 * In production, internal messages are never leaked — clients see only
 * stable codes and generic messages. Detailed errors stay in logs.
 */

import type { ErrorRequestHandler } from 'express';

import { ERROR_CODES, type ApiError, type ApiResponse } from '@styleme/shared';

import { isProd } from '../env';
import { logger } from '../logger';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Already-sent response: can't recover, just log.
  if (res.headersSent) {
    logger.error({ err, reqId: req.id }, '[errorHandler] headers already sent');
    return;
  }

  if (err instanceof HttpError) {
    const apiError: ApiError = {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    };
    res.status(err.status).json({ success: false, error: apiError } satisfies ApiResponse);
    return;
  }

  // Unknown / unexpected error: log full details, return generic to client.
  logger.error({ err, reqId: req.id, path: req.path, method: req.method }, '[errorHandler] unhandled');
  const message = isProd ? 'Internal server error' : (err as Error).message ?? 'Internal server error';
  res.status(500).json({
    success: false,
    error: { code: ERROR_CODES.INTERNAL_ERROR, message },
  } satisfies ApiResponse);
};
