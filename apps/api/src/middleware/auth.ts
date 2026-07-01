/**
 * Authentication middleware.
 *
 * Verifies a Supabase JWT from the `Authorization: Bearer ...` header.
 *
 * Supabase moved to asymmetric JWT signing keys (ES256/RS256) via JWKS
 * in 2025–2026. Newer projects sign tokens with ECC P-256 keys and expose
 * the public key set at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`.
 * Older projects still use HS256 with a shared `SUPABASE_JWT_SECRET`.
 *
 * This middleware supports both:
 *  - Prefers JWKS verification when `SUPABASE_URL` is configured.
 *  - Falls back to HS256 with `SUPABASE_JWT_SECRET` for legacy projects.
 *
 * If Supabase is not configured (dev fallback), a deterministic dev user
 * id is derived from the request — so endpoints that need auth still
 * work locally without Supabase credentials.
 */

import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';

import { ERROR_CODES } from '@styleme/shared';

import { env, hasSupabase, isProd } from '../env';
import { logger } from '../logger';

export interface AuthenticatedUser {
  id: string;
  isAnonymous: boolean;
  email?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

interface SupabaseJwtPayload extends JWTPayload {
  sub?: string;
  email?: string;
  is_anonymous?: boolean;
  role?: string;
}

// Lazy-initialized JWKS fetcher. Caches keys; refreshes on rotation.
let jwks: JWTVerifyGetKey | null = null;
function getJwks(): JWTVerifyGetKey | null {
  if (!env.SUPABASE_URL) return null;
  if (jwks) return jwks;
  const url = new URL('/auth/v1/.well-known/jwks.json', env.SUPABASE_URL);
  jwks = createRemoteJWKSet(url, {
    cooldownDuration: 30_000,   // don't refetch keys more than once per 30s
    cacheMaxAge: 10 * 60_000,   // cache for 10 minutes
  });
  return jwks;
}

// HS256 shared-secret key (for legacy projects). Encoded once and reused.
let hsKey: Uint8Array | null = null;
function getHsKey(): Uint8Array | null {
  if (!env.SUPABASE_JWT_SECRET) return null;
  if (hsKey) return hsKey;
  hsKey = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
  return hsKey;
}

function extractToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function devUserFromRequest(req: Request): AuthenticatedUser {
  const seed = `${req.ip ?? 'unknown'}|${req.header('user-agent') ?? 'unknown'}`;
  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  return {
    id: `dev-${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`,
    isAnonymous: true,
  };
}

async function verifyToken(token: string): Promise<AuthenticatedUser | null> {
  // 1) Try asymmetric (ES256/RS256) via JWKS first — this is the modern path.
  const keySet = getJwks();
  if (keySet) {
    try {
      const { payload } = await jwtVerify<SupabaseJwtPayload>(token, keySet, {
        algorithms: ['ES256', 'RS256'],
      });
      if (!payload.sub) return null;
      return {
        id: payload.sub,
        isAnonymous: Boolean(payload.is_anonymous),
        email: payload.email,
      };
    } catch (err) {
      // Not signed with an asymmetric key (or signature mismatch) —
      // fall through to HS256 if a shared secret is available.
      logger.debug({ err: (err as Error).message }, '[auth] JWKS verify failed, trying HS256');
    }
  }

  // 2) Legacy HS256 fallback.
  const sharedKey = getHsKey();
  if (sharedKey) {
    try {
      const { payload } = await jwtVerify<SupabaseJwtPayload>(token, sharedKey, {
        algorithms: ['HS256'],
      });
      if (!payload.sub) return null;
      return {
        id: payload.sub,
        isAnonymous: Boolean(payload.is_anonymous),
        email: payload.email,
      };
    } catch (err) {
      logger.debug({ err: (err as Error).message }, '[auth] HS256 verify failed');
    }
  }

  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!hasSupabase) {
    if (isProd) {
      res.status(500).json({
        success: false,
        error: { code: ERROR_CODES.CONFIG_MISSING, message: 'Auth not configured' },
      });
      return;
    }
    req.user = devUserFromRequest(req);
    return next();
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Missing or invalid authorization header' },
    });
    return;
  }

  void (async () => {
    const user = await verifyToken(token);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired token' },
      });
      return;
    }
    req.user = user;
    next();
  })();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!hasSupabase) {
    req.user = devUserFromRequest(req);
    return next();
  }
  const token = extractToken(req);
  if (!token) return next();
  void (async () => {
    const user = await verifyToken(token);
    if (user) req.user = user;
    next();
  })();
}
