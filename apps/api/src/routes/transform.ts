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
 * Hotfix (post-Day 4): server-side retry with backoff for Replicate 429.
 * Day 5 (ADR-008): insertGeneration now carries `mode` + `customPrompt`
 * so history can drive deterministic Regenerate.
 * Day 7 (ADR-010): `getPromptById` → `getPrompt('hairstyle', id)`.
 * `styleName` is now written from `HAIRSTYLE_CANONICAL_NAME_EN` — it is
 * a debug/analytics label only, never rendered as-is in the UI (the web
 * app resolves display names client-side via i18n, keyed by styleId).
 * `'Reference photo'` literal below stays server-side only for the same
 * reason — the UI never reads `TransformResult.style` for display.
 * Day 8 (ADR-011): retry/output helpers extracted to lib/replicate-retry.ts
 * for unit testing; prompt typos fixed ("thehair" → "the hair",
 * "Keepthe" → "Keep the").
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import Replicate from 'replicate';

import {
  ACCEPTED_MIME_TYPES,
  ERROR_CODES,
  HAIRSTYLES_UI_BY_ID,
  HAIRSTYLE_CANONICAL_NAME_EN,
  LIMITS,
  isValidStyleId,
  transformByStyleIdSchema,
  transformCustomSchema,
  type ApiResponse,
  type GenerationMode,
  type TransformResult,
} from '@styleme/shared';
import { getPrompt } from '@styleme/shared/hairstyles/prompts';

import { insertGeneration } from '../db/generations';
import { env } from '../env';
import { consumeOne, getBalance } from '../lib/quota';
import {
  REPLICATE_MAX_ATTEMPTS,
  extractResultUrl,
  isReplicate429,
  parseRetryAfterMs,
} from '../lib/replicate-retry';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/error-handler';
import { transformRateLimit } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';

export const transformRouter = Router();

// nano-banana cost ~$0.039 per call = 39 tenths of a cent. Stored for billing.
const COST_CENTS_PER_GENERATION = 4;

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

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

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function runReplicateWithRetry(input: unknown, userId: string): Promise<unknown> {
  let lastRetryAfterMs = 0;
  for (let attempt = 1; attempt <= REPLICATE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await replicate.run('google/nano-banana', {
        input: input as Record<string, unknown>,
      });
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
  throw new HttpError(500, ERROR_CODES.INTERNAL_ERROR, 'Retry loop exited unexpectedly');
}

interface RunTransformArgs {
  userId: string;
  imageBuffer: Buffer;
  refBuffer?: Buffer;
  prompt: string;
  /** Day 5: recorded on the row so Regenerate can reconstruct the pipeline. */
  mode: GenerationMode;
  styleId: number | null;
  /** Day 7: debug/analytics label only — see file header. */
  styleName: string;
  /** Only meaningful when mode === 'custom'. */
  customPrompt: string | null;
}

async function runTransform(args: RunTransformArgs): Promise<TransformResult> {
  const start = Date.now();

  // 1. Pre-flight quota check
  const balanceBefore = await getBalance(args.userId);
  if (balanceBefore.freeRemaining === 0 && balanceBefore.rewarded === 0) {
    throw new HttpError(403, ERROR_CODES.QUOTA_EXCEEDED, 'No credits remaining', {
      balance: balanceBefore,
    });
  }

  // 2. Optimize images
  const mainOptimized = await optimizeImage(args.imageBuffer);
  const mainDataUrl = toDataUrl(mainOptimized);
  let refDataUrl: string | undefined;
  if (args.refBuffer) {
    const refOptimized = await optimizeImage(args.refBuffer);
    refDataUrl = toDataUrl(refOptimized);
  }

  // 3. Call upstream with retry
  const input = {
    prompt: args.prompt,
    image_input: refDataUrl ? [mainDataUrl, refDataUrl] : [mainDataUrl],
  };
  let resultUrl: string;
  try {
    const output = await runReplicateWithRetry(input, args.userId);
    resultUrl = extractResultUrl(output);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    logger.error({ err, userId: args.userId }, '[transform] upstream failed');
    throw new HttpError(502, ERROR_CODES.UPSTREAM_FAILED, 'Image generation failed upstream');
  }

  // 4. Consume credit
  const consume = await consumeOne(args.userId);
  if (!consume.ok) {
    logger.warn({ userId: args.userId }, '[transform] consume race after upstream success');
  }

  // 5. Record to DB (best-effort)
  const generationId = await insertGeneration({
    userId: args.userId,
    mode: args.mode,
    styleId: args.styleId,
    styleName: args.styleName,
    customPrompt: args.customPrompt,
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
// POST /api/transform — preset
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
      // Confirm the id resolves in the UI catalog too (keeps both maps
      // in lockstep — a prompt with no UI entry, or vice versa, is a bug).
      if (!HAIRSTYLES_UI_BY_ID.has(styleId)) {
        throw new HttpError(500, ERROR_CODES.INTERNAL_ERROR, 'Style id missing from UI catalog');
      }
      const prompt = getPrompt('hairstyle', styleId);
      if (!prompt) {
        throw new HttpError(500, ERROR_CODES.INTERNAL_ERROR, 'Prompt not found');
      }
      const styleName = HAIRSTYLE_CANONICAL_NAME_EN.get(styleId) ?? `Style #${styleId}`;
      const result = await runTransform({
        userId: req.user!.id,
        imageBuffer: req.file.buffer,
        prompt,
        mode: 'preset',
        styleId,
        styleName,
        customPrompt: null,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// POST /api/transform/custom
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
        mode: 'custom',
        styleId: null,
        styleName: hairstyle,
        customPrompt: hairstyle,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// POST /api/transform/reference
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
        mode: 'reference',
        styleId: null,
        // Debug label only — UI shows a translated generic label instead.
        styleName: 'Reference photo (debug label)',
        customPrompt: null,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);
