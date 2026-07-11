/**
 * Replicate mock (Day 8 Wave 2a, ADR-012) — E2E-only stand-in for the
 * upstream model call. Enabled solely via REPLICATE_MOCK=1 (hard-blocked
 * in production by env.ts).
 *
 * Design goals:
 *  - Everything EXCEPT the model call stays real: auth, rate limit, quota
 *    pre-check + consume, sharp optimization, DB insert, balance snapshot.
 *  - Returns a data-URL string — one of the shapes extractResultUrl
 *    already accepts, so zero special-casing downstream.
 *  - Artificial ~300ms latency so the web app's processing screen actually
 *    renders and E2E asserts the real state transition, not an instant jump.
 *
 * Hotfix (post-Wave-2a manual smoke): the original mock was a 16x16
 * SOLID-COLOR JPEG, which reads as a blank/white rectangle when stretched
 * into the result-screen <img> — indistinguishable from "nothing loaded"
 * during manual testing. Replaced with a 64x64 gradient + circle so a
 * human glancing at the result screen can immediately tell the mock
 * fired. Purely cosmetic — Playwright assertions never inspected pixel
 * content, so this does not change any test's pass/fail behavior.
 */

const MOCK_LATENCY_MS = 300;

// 64x64 JPEG: diagonal gradient background + a circle, ~1.2KB.
// Visibly non-blank when rendered, unlike the old solid-color version.
const MOCK_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIf' +
  'IiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7' +
  'Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCABAAEADASIA' +
  'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
  'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
  'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
  'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA' +
  'AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx' +
  'BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK' +
  'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3' +
  'uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCmqVIq' +
  'VIqVIkZYgAEk9AO9ek5HRCZGqVIqVr2ukKo3XHJ7KDx+NaCRRx58uNUz12jGa4p4uKdlqdsZ2ObV' +
  'KkVK6FkRxh1DD0IzVaawjb5ovkb07VmsUnurHRCuuplqlSKlS+UUYqwwRTlStHI9KnMzFStbS7UK' +
  'v2hupyF/xqiqVuxp5capnO0AZqMRUajZdT5TDe879h1FFFeedwUUUUAQzxB13d1qFUq5UYTmtoS' +
  '0sdmHn0MtUrXU7lDDuM1QVKtwN8m09RV1tVc+ewVRczi+pLRRRXMeqFFFFABT1SkjTc3sKsKlO9' +
  'jWk7MzFSpFTHNSKlSKlauR8jTnYZg0VMqVIIweozWTaPXpYx2tJXKtPSFn9h61aWIDoAPwqVUqH' +
  'I6FiL7ESRBRgCpVSpFSpFSs3I3hM//Z';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Drop-in replacement for runReplicateWithRetry when REPLICATE_MOCK=1. */
export async function runReplicateMock(): Promise<string> {
  await sleep(MOCK_LATENCY_MS);
  return `data:image/jpeg;base64,${MOCK_JPEG_BASE64}`;
}
