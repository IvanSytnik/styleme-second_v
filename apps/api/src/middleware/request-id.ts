import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const fromHeader = req.header('x-request-id');
  req.id = fromHeader && fromHeader.length <= 64 ? fromHeader : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
