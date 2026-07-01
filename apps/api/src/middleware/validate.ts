/**
 * Generic Zod validation middleware.
 *
 * Validates `req.body` (default) or a chosen source against a Zod schema.
 * On success, replaces `req.body` with the parsed/coerced result so
 * downstream handlers get the typed value.
 */

import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema, ZodError } from 'zod';

import { ERROR_CODES, type ApiResponse } from '@styleme/shared';

type Source = 'body' | 'query' | 'params';

function formatZodError(error: ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

export function validate<T>(schema: ZodSchema<T>, source: Source = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Request validation failed',
          details: { fields: formatZodError(result.error) },
        },
      } satisfies ApiResponse);
      return;
    }
    // Replace with parsed (coerced) value
    (req as unknown as Record<Source, T>)[source] = result.data;
    next();
  };
}
