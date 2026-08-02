/**
 * Centralized error handler.
 *
 * Converts any thrown error into the shared ApiResponse envelope.
 * In production, internal messages are never leaked — clients see only
 * stable codes and generic messages. Detailed errors stay in logs.
 *
 * Day 8 Wave 2b: multer 2.x upload errors (MulterError) and our own
 * UnsupportedMimeError are now mapped to stable envelope codes instead of
 * falling through to a generic 500. Previously an oversized upload or a
 * bad MIME returned 500 INTERNAL_ERROR with no actionable client code.
 */
import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
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

/**
 * Thrown by the multer fileFilter when an upload's MIME type is not in the
 * allowlist. A dedicated class lets the error handler discriminate by type
 * (instanceof) rather than by matching a magic string in `message`
 * (LESSONS_LEARNED: "explicit discriminators beat heuristics").
 */
export class UnsupportedMimeError extends Error {
  constructor(public readonly mimetype: string) {
    super(`Unsupported MIME type: ${mimetype}`);
    this.name = 'UnsupportedMimeError';
  }
}

/**
 * Map a multer MulterError.code to our stable envelope. Only a subset can
 * occur given our config (single/fields + fileSize limit); the rest fall
 * back to VALIDATION_FAILED so the client still gets a 4xx, never a 500.
 */
function mapMulterError(err: MulterError): {
  status: number;
  code: string;
  message: string;
} {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return {
        status: 413,
        code: ERROR_CODES.FILE_TOO_LARGE,
        message: 'File is too large',
      };
    case 'LIMIT_UNEXPECTED_FILE':
      return {
        status: 400,
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Unexpected file field',
      };
    default:
      // LIMIT_FILE_COUNT, LIMIT_PART_COUNT, LIMIT_FIELD_* — not reachable
      // with our current config, but guard against a 500 regardless.
      return {
        status: 400,
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Invalid upload',
      };
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

  // multer 2.x: file-size / field-count / parse errors.
  if (err instanceof MulterError) {
    const mapped = mapMulterError(err);
    logger.warn(
      { reqId: req.id, multerCode: err.code, field: err.field },
      '[errorHandler] multer upload rejected',
    );
    res.status(mapped.status).json({
      success: false,
      error: { code: mapped.code, message: mapped.message },
    } satisfies ApiResponse);
    return;
  }

  // Our fileFilter rejection.
  if (err instanceof UnsupportedMimeError) {
    logger.warn(
      { reqId: req.id, mimetype: err.mimetype },
      '[errorHandler] unsupported upload mime',
    );
    res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.UNSUPPORTED_MIME,
        message: 'Unsupported file type. Use JPEG, PNG or WebP.',
      },
    } satisfies ApiResponse);
    return;
  }

  // Unknown / unexpected error: log full details, return generic to client.
  logger.error(
    { err, reqId: req.id, path: req.path, method: req.method },
    '[errorHandler] unhandled',
  );
  const message = isProd ? 'Internal server error' : (err as Error).message ?? 'Internal server error';
  res.status(500).json({
    success: false,
    error: { code: ERROR_CODES.INTERNAL_ERROR, message },
  } satisfies ApiResponse);
};
