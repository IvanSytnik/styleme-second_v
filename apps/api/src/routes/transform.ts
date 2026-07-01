/**
 * Transform routes.
 *
 *  POST /api/transform           — preset hairstyle by styleId
 *  POST /api/transform/custom    — free-form description
 *  POST /api/transform/reference — main + reference image
 *
 * All endpoints require auth, are user-rate-limited, quota-checked, and
 * record each successful generation to Supabase.
 *
 * Wire format: `multipart/form-data` (no more 50 MB base64 in JSON).
 *
 * Hotfix (post-Day 4): server-side retry with backoff for Replicate 429
 * responses. Under $5 in Replicate credits the account rate limit drops to
 * 6 req/min with burst=1, which surfaces to users as random single-shot
 * "generation failed". We now transparently retry up to 3 times honouring
 * the `retry_after` hint before surfacing RATE_LIMITED to the client.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import Replicate from 'replicate';

import {
  ACCEPTED_MIME_TYPES,
  ERROR_CODES,
  HAIRSTYLES_UI_BY_ID,
  LIMITS,
  isValidStyleId,
  transformByStyleIdSchema,
  transformCustomSchema,
  type ApiResponse,
  type TransformResult,
} from '@styleme/shared';
import { getPromptById } from '@styleme/shared/hairstyles/prompts';

import { insertGeneration } from '../db/generations';
import { env } from '../env';
import { consumeOne, getBalance } from '../lib/quota';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/error-handler';
import { transformRateLimit } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';

export const transformRouter = Router();

// nano-banana cost ~$0.039 per call = 39 tenths of a cent. Stored for billing.
const COST_CENTS_PER_GENERATION = 4;

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

// ============================================================================
// Replicate retry configuration
// ============================================================================

/** Total attempts (1 original + up to N-1 retries). */
const REPLICATE_MAX_ATTEMPTS = 3;
/** Cap on a single retry_after honoured from upstream. */
const REPLICATE_MAX_RETRY_WAIT_MS = 10_000;
/** Fallback wait when upstream doesn't tell us retry_after. */
const REPLICATE_DEFAULT_RETRY_WAIT_MS = 5_000;
/** Jitter added to every wait, to avoid thundering herd on shared quota. */
const REPLICATE_JITTER_MS = 1_000;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: LIMITS.MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if ((ACCEPTED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('UNSUPPORTED_MIME'));
    }
  },
});

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(LIMITS.MAX_IMAGE_DIMENSION, LIMITS.MAX_IMAGE_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: LIMITS.JPEG_QUALITY })
    .toBuffer();
}

const toDataUrl = (buffer: Buffer): string =>
  `data:image/jpeg;base64,${buffer.toString('base64')}`;

function extractResultUrl(output: unknown): string {
  if (
    output &&
    typeof output === 'object' &&
    'url' in output &&
    typeof (output as { url: () => string }).url === 'function'
  ) {
    return (output as { url: () => string }).url();
  }
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (
      first &&
      typeof first === 'object' &&
      'url' in first &&
      typeof (first as { url: () => string }).url === 'function'
    ) {
      return (first as { url: () => string }).url();
    }
  }
  throw new HttpError(
    502,
    ERROR_CODES.UPSTREAM_FAILED,
    'Unexpected output format from upstream',
  );
}

// ============================================================================
// 429 detection + retry helpers
// ============================================================================

/**
 * True if the error looks like a Replicate 429.
 *
 * Replicate SDK throws an `ApiError` with `.response` (Fetch Response) and a
 * message like `Request to ... failed with status 429 Too Many Requests: {...}`.
 * We check both channels — response.status is authoritative but doesn't always
 * survive serialisation, so the message pattern is our safety net.
 */
function isReplicate429(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name !== 'ApiError') return false;
  const withResponse = err as Error & { response?: { status?: number } };
  if (withResponse.response?.status === 429) return true;
  return /\bstatus\s+429\b/i.test(err.message);
}

/**
 * Parse `retry_after` (seconds) from the JSON body embedded in the ApiError
 * message. Returns milliseconds, clamped to REPLICATE_MAX_RETRY_WAIT_MS.
 * Falls back to REPLICATE_DEFAULT_RETRY_WAIT_MS if not found.
 */
function parseRetryAfterMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : '';
  const match = /"retry_after"\s*:\s*(\d+(?:\.\d+)?)/.exec(msg);
  const seconds = match ? Number.parseFloat(match[1]!) : NaN;
  const ms = Number.isFinite(seconds)
    ? Math.min(seconds * 1000, REPLICATE_MAX_RETRY_WAIT_MS)
    : REPLICATE_DEFAULT_RETRY_WAIT_MS;
  return ms + Math.floor(Math.random() * REPLICATE_JITTER_MS);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `replicate.run('google/nano-banana', ...)` with server-side 429 retry.
 *
 * - On non-429 error: throws immediately (caller decides how to surface).
 * - On 429 with attempts remaining: sleeps for `retry_after` (+ jitter) and retries.
 * - On 429 after final attempt: throws HttpError(429, RATE_LIMITED) with the
 *   latest retryAfterMs so the client can present a helpful message.
 *
 * NOTE: Replicate doesn't bill 429s — they reject before generation — so
 * retries are financially free.
 */
async function runReplicateWithRetry(input: unknown, userId: string): Promise<unknown> {
  let lastRetryAfterMs = 0;
  for (let attempt = 1; attempt <= REPLICATE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await replicate.run('google/nano-banana', { input: input as Record<string, unknown> });
    } catch (err) {
      if (!isReplicate429(err)) throw err;

      lastRetryAfterMs = parseRetryAfterMs(err);

      if (attempt < REPLICATE_MAX_ATTEMPTS) {
        logger.warn(
          { userId, attempt, retryAfterMs: lastRetryAfterMs },
          '[transform] replicate 429, retrying',
        );
        await sleep(lastRetryAfterMs);
        continue;
      }

      logger.warn(
        { userId, attempts: REPLICATE_MAX_ATTEMPTS },
        '[transform] replicate 429, giving up',
      );
      throw new HttpError(
        429,
        ERROR_CODES.RATE_LIMITED,
        'Servers are busy right now. Please try again in a moment.',
        { retryAfterMs: lastRetryAfterMs, attempts: REPLICATE_MAX_ATTEMPTS },
      );
    }
  }
  // Unreachable — loop either returns or throws. Satisfies control flow analysis.
  throw new HttpError(500, ERROR_CODES.INTERNAL_ERROR, 'Retry loop exited unexpectedly');
}

interface RunTransformArgs {
  userId: string;
  imageBuffer: Buffer;
  refBuffer?: Buffer;
  prompt: string;
  styleId: number | null;
  styleName: string;
}

async function runTransform(args: RunTransformArgs): Promise<TransformResult> {
  const start = Date.now();

  // 1. Pre-flight quota check (cheap fail before paying Replicate)
  const balanceBefore = await getBalance(args.userId);
  if (balanceBefore.freeRemaining === 0 && balanceBefore.rewarded === 0) {
    throw new HttpError(403, ERROR_CODES.QUOTA_EXCEEDED, 'No credits remaining', {
      balance: balanceBefore,
    });
  }

  // 2. Optimize image(s)
  const mainOptimized = await optimizeImage(args.imageBuffer);
  const mainDataUrl = toDataUrl(mainOptimized);
  let refDataUrl: string | undefined;
  if (args.refBuffer) {
    const refOptimized = await optimizeImage(args.refBuffer);
    refDataUrl = toDataUrl(refOptimized);
  }

  // 3. Call upstream (with 429 retry)
  const input = {
    prompt: args.prompt,
    image_input: refDataUrl ? [mainDataUrl, refDataUrl] : [mainDataUrl],
  };
  let resultUrl: string;
  try {
    const output = await runReplicateWithRetry(input, args.userId);
    resultUrl = extractResultUrl(output);
  } catch (err) {
    // 429-after-retries is already an HttpError from runReplicateWithRetry.
    // Let it fall through error-handler middleware untouched.
    if (err instanceof HttpError) throw err;
    logger.error({ err, userId: args.userId }, '[transform] upstream failed');
    throw new HttpError(502, ERROR_CODES.UPSTREAM_FAILED, 'Image generation failed upstream');
  }

  // 4. Consume credit AFTER successful upstream call (no charge on failure)
  const consume = await consumeOne(args.userId);
  if (!consume.ok) {
    // Shouldn't happen — we pre-flighted — but if it does, log and proceed.
    // Credit was clearly there a moment ago; treat as race.
    logger.warn({ userId: args.userId }, '[transform] consume race after upstream success');
  }

  // 5. Record to DB (best-effort)
  const generationId = await insertGeneration({
    userId: args.userId,
    styleId: args.styleId,
    styleName: args.styleName,
    resultUrl,
    costCents: COST_CENTS_PER_GENERATION,
  });

  const balance = consume.ok ? consume.balance : await getBalance(args.userId);

  return {
    resultImage: resultUrl,
    style: args.styleName,
    processingTime: Date.now() - start,
    generationId,
    balance,
  };
}

// ============================================================================
// POST /api/transform — by preset styleId
// ============================================================================

transformRouter.post(
  '/api/transform',
  requireAuth,
  transformRateLimit,
  upload.single('image'),
  validate(transformByStyleIdSchema),
  async (req: Request, res: Response<ApiResponse<TransformResult>>, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, 'Image file is required');
      }
      const { styleId } = req.body as { styleId: number };
      if (!isValidStyleId(styleId)) {
        throw new HttpError(400, ERROR_CODES.INVALID_STYLE_ID, 'Invalid hairstyle id');
      }
      const style = HAIRSTYLES_UI_BY_ID.get(styleId)!;
      const prompt = getPromptById(styleId);
      if (!prompt) {
        throw new HttpError(500, ERROR_CODES.INTERNAL_ERROR, 'Prompt not found');
      }
      const result = await runTransform({
        userId: req.user!.id,
        imageBuffer: req.file.buffer,
        prompt,
        styleId,
        styleName: style.name,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// POST /api/transform/custom — free-form hairstyle description
// ============================================================================

transformRouter.post(
  '/api/transform/custom',
  requireAuth,
  transformRateLimit,
  upload.single('image'),
  validate(transformCustomSchema),
  async (req: Request, res: Response<ApiResponse<TransformResult>>, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, 'Image file is required');
      }
      const { hairstyle } = req.body as { hairstyle: string };
      const prompt = `Change the hairstyle to ${hairstyle}. Keep the face exactly the same, only change the hair. Make it look natural and photorealistic.`;
      const result = await runTransform({
        userId: req.user!.id,
        imageBuffer: req.file.buffer,
        prompt,
        styleId: null,
        styleName: hairstyle,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// POST /api/transform/reference — main + reference image
// ============================================================================

transformRouter.post(
  '/api/transform/reference',
  requireAuth,
  transformRateLimit,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'reference', maxCount: 1 },
  ]),
  async (req: Request, res: Response<ApiResponse<TransformResult>>, next: NextFunction) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const main = files?.image?.[0];
      const reference = files?.reference?.[0];
      if (!main || !reference) {
        throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, 'Both image and reference are required');
      }
      const prompt =
        'Copy the exact hairstyle from the second image and apply it to the person in the first image. Keep the face of the first person exactly the same, only change their hair to match the hairstyle, color, and style in the second image. Make it look natural and photorealistic.';
      const result = await runTransform({
        userId: req.user!.id,
        imageBuffer: main.buffer,
        refBuffer: reference.buffer,
        prompt,
        styleId: null,
        styleName: 'Reference photo',
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);
