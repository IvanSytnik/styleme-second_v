/**
 * Typed API client.
 *
 * - Business endpoints (`/api/*`) use the shared envelope `ApiResponse<T>`.
 * - System endpoints (`/health`) return a plain object.
 * - Bearer token (Supabase JWT) attached automatically when available.
 */

import type {
  ApiResponse,
  BillingBalance,
  ErrorCode,
  HairstyleListItem,
  HealthCheckResponse,
  TransformResult,
} from '@styleme/shared';

import { getAuthToken } from './auth-provider';
import { publicEnv } from './env';

export class ApiClientError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(opts: { code: string; message: string; status: number; details?: Record<string, unknown> }) {
    super(opts.message);
    this.name = 'ApiClientError';
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
  }
}

async function fetchJson(
  path: string,
  init?: RequestInit,
): Promise<{ res: Response; body: unknown }> {
  const url = `${publicEnv.NEXT_PUBLIC_API_URL}${path}`;
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError({
      code: 'INTERNAL_ERROR',
      message: 'Failed to parse server response',
      status: res.status,
    });
  }

  return { res, body };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { res, body } = await fetchJson(path, init);
  const envelope = body as ApiResponse<T> | null;
  if (!res.ok || !envelope || envelope.success !== true) {
    throw new ApiClientError({
      code: envelope?.error?.code ?? 'INTERNAL_ERROR',
      message: envelope?.error?.message ?? `Request failed: ${res.status}`,
      status: res.status,
      details: envelope?.error?.details,
    });
  }
  if (envelope.data === undefined) {
    throw new ApiClientError({
      code: 'INTERNAL_ERROR',
      message: 'Server returned success without data',
      status: res.status,
    });
  }
  return envelope.data;
}

async function requestPlain<T>(path: string, init?: RequestInit): Promise<T> {
  const { res, body } = await fetchJson(path, init);
  if (!res.ok) {
    throw new ApiClientError({
      code: 'INTERNAL_ERROR',
      message: `Request failed: ${res.status}`,
      status: res.status,
    });
  }
  return body as T;
}

export const api = {
  health: () => requestPlain<HealthCheckResponse>('/health'),

  listHairstyles: (gender?: 'male' | 'female') => {
    const qs = gender ? `?gender=${gender}` : '';
    return request<HairstyleListItem[]>(`/api/hairstyles${qs}`);
  },

  getBalance: () => request<BillingBalance>('/api/billing/balance'),

  grantReward: (token = 'dev-token') =>
    request<BillingBalance>('/api/billing/grant-reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }),

  transformByStyleId: (image: Blob, styleId: number) => {
    const fd = new FormData();
    fd.append('image', image);
    fd.append('styleId', String(styleId));
    return request<TransformResult>('/api/transform', { method: 'POST', body: fd });
  },

  transformCustom: (image: Blob, hairstyle: string) => {
    const fd = new FormData();
    fd.append('image', image);
    fd.append('hairstyle', hairstyle);
    return request<TransformResult>('/api/transform/custom', { method: 'POST', body: fd });
  },

  transformWithReference: (image: Blob, reference: Blob) => {
    const fd = new FormData();
    fd.append('image', image);
    fd.append('reference', reference);
    return request<TransformResult>('/api/transform/reference', { method: 'POST', body: fd });
  },
};
