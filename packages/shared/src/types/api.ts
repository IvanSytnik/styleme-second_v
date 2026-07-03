/**
 * Shared API contracts between web and api apps.
 */

export type Gender = 'male' | 'female';
export type TabType = 'female' | 'male' | 'reference';
export type Screen = 'upload' | 'select' | 'processing' | 'result';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface TransformResult {
  resultImage: string;
  style: string;
  processingTime: number;
  /** Generation row id in Supabase (for history lookups). */
  generationId: string;
  /** Updated balance snapshot returned with each successful transform. */
  balance: BillingBalance;
}

export interface HairstyleListItem {
  id: number;
  name: string;
  gender: Gender;
  emoji: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  totalStyles: number;
}

/**
 * Snapshot of a user's generation quota.
 */
export interface BillingBalance {
  /** Free credits remaining today (resets at 00:00 UTC). */
  freeRemaining: number;
  /** Total free credits per day (constant). */
  freeDaily: number;
  /** Rewarded credits accumulated from ad views. */
  rewarded: number;
  /** Seconds until free credits reset. */
  freeResetInSeconds: number;
}

/**
 * Day 6 (ADR-009): issued by POST /api/billing/ad-session.
 * The client must show the ad, wait at least `minWatchSeconds`,
 * then claim via POST /api/billing/grant-reward { nonce }.
 */
export interface AdSession {
  nonce: string;
  minWatchSeconds: number;
  /** How many rewarded views the user has left today (after this one). */
  viewsRemainingToday: number;
}

export type GenerationMode = 'preset' | 'custom' | 'reference';

export interface Generation {
  id: string;
  userId: string;
  mode: GenerationMode;
  styleId: number | null;
  styleName: string;
  /** Present iff mode === 'custom'. */
  customPrompt: string | null;
  resultUrl: string;
  costCents: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface GenerationListPage {
  items: Generation[];
  nextCursor: string | null;
}
