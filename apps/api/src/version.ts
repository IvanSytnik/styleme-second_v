/**
 * API version, sourced from apps/api/package.json — the one place it is bumped.
 *
 * Not a static import: package.json sits outside tsconfig `rootDir` (./src), so
 * `import pkg from '../package.json'` fails the build (TS6059) and relaxing
 * rootDir would reshape dist/ into dist/src/**, breaking `main: dist/server.js`
 * and the Railway startCommand. A CJS require resolves identically from src/
 * (ts-node dev) and dist/ (prod) — both are one level under apps/api.
 */

// Cast rather than `any`: package.json has no type, and only `version` is read.
const pkg = require('../package.json') as { version: string };

export const API_VERSION = pkg.version;
