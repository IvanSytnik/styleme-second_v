import { ACCEPTED_MIME_TYPES, LIMITS } from '@styleme/shared';

/**
 * Stable, machine-readable reasons a picked file is rejected. Screens map
 * these to their own i18n namespace — the helper stays presentation-free.
 */
export type SourceFileError = 'unsupportedFormat' | 'tooLarge';

/**
 * Validates a user-picked file BEFORE client-side resize.
 *
 * Single source of truth for both the primary upload screen and the
 * reference-photo view, which previously disagreed on both the MIME
 * allowlist and the size ceiling. Returns null when the file is acceptable.
 *
 * Discriminates via explicit checks rather than letting the resize step fail
 * later (LESSONS_LEARNED: explicit discriminators beat heuristics).
 */
export function validateSourceFile(file: File): SourceFileError | null {
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'unsupportedFormat';
  }
  if (file.size > LIMITS.MAX_SOURCE_SIZE_BYTES) {
    return 'tooLarge';
  }
  return null;
}
