/**
 * Public root export. Safe for both server and client.
 *
 * Prompts are NOT re-exported — import them via
 * `@styleme/shared/hairstyles/prompts` from server code only.
 */

export * from './types/api';
export * from './constants/limits';
export * from './hairstyles/ui';
export * from './schemas';
