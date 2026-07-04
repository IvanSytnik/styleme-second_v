/**
 * next-intl proxy (Day 7 hotfix).
 *
 * Renamed from `middleware.ts` per Next.js 16: the file convention is
 * renamed `middleware` -> `proxy` (filename only -- createMiddleware's
 * return value is already a plain default-exported function, so no
 * internal rename was needed). Behavior and matcher are unchanged.
 * See https://nextjs.org/docs/messages/middleware-to-proxy
 *
 * Note: proxy.ts always runs on the Node.js runtime in Next 16 (the
 * `runtime` config option is unavailable here) -- unlike the old
 * middleware.ts, which defaulted to Edge. Not a concern for us: this
 * file only does locale negotiation, no I/O.
 */
import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
