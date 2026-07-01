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

const toDataUrl = (buffer: Buffer): string => `data:image/jpeg;base64,${buffer.toString('base64')}`;

function extractResultUrl(output: unknown): string {
  if (output && typeof output === 'object' && 'url' in output && typeof (output as { url: () => string }).url === 'function') {
    return (output as { url: () => string }).url();
  }
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'url' in first && typeof (first as { url: () => string }).url === 'function') {
      return (first as { url: () => string }).url();
    }
  }
  throw new HttpError(502, ERROR_CODES.UPSTREAM_FAILED, 'Unexpected output format from upstream');
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

  // 3. Call upstream
  const input = {
    prompt: args.prompt,
    image_input: refDataUrl ? [mainDataUrl, refDataUrl] : [mainDataUrl],
  };
  let resultUrl: string;
  try {
    const output = await replicate.run('google/nano-banana', { input });
    resultUrl = extractResultUrl(output);
  } catch (err) {
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
