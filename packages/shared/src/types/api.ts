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

export interface Generation {
  id: string;
  userId: string;
  styleId: number | null;
  styleName: string;
  resultUrl: string;
  costCents: number;
  createdAt: string;
}
