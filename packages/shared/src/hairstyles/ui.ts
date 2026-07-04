/**
 * UI-facing hairstyle catalog.
 *
 * Day 7 (ADR-010 / D2): `name` is REMOVED from this data. Display names
 * live in i18n dictionaries (`apps/web/src/messages/<locale>.json`,
 * namespace `catalog.hairstyle.presets.<id>.name`), keyed by the numeric
 * `id` below — the same id already used as `Generation.styleId` (FK).
 * No separate text slug was introduced (rejected in ADR-010 as YAGNI):
 * the numeric id was already the stable identity everywhere that matters
 * (DB, API, Map lookups); adding a second identity would only add a sync
 * burden with zero current consumer.
 *
 * Prompts live in ./prompts.ts and are server-only — never import that
 * file from any browser-facing code (separate subpath export enforces it).
 */

import type { HairstyleListItem } from '../types/api';

export const HAIRSTYLES_UI: readonly HairstyleListItem[] = [
  // ===== FEMALE (1–20) =====
  { id: 1,  gender: 'female', emoji: '💇‍♀️' },
  { id: 2,  gender: 'female', emoji: '✨' },
  { id: 3,  gender: 'female', emoji: '⭐' },
  { id: 4,  gender: 'female', emoji: '🌟' },
  { id: 5,  gender: 'female', emoji: '🌊' },
  { id: 6,  gender: 'female', emoji: '🏖️' },
  { id: 7,  gender: 'female', emoji: '🔥' },
  { id: 8,  gender: 'female', emoji: '💎' },
  { id: 9,  gender: 'female', emoji: '🌀' },
  { id: 10, gender: 'female', emoji: '🥐' },
  { id: 11, gender: 'female', emoji: '🎀' },
  { id: 12, gender: 'female', emoji: '🐴' },
  { id: 13, gender: 'female', emoji: '🥊' },
  { id: 14, gender: 'female', emoji: '👸' },
  { id: 15, gender: 'female', emoji: '🎭' },
  { id: 16, gender: 'female', emoji: '📐' },
  { id: 17, gender: 'female', emoji: '🎬' },
  { id: 18, gender: 'female', emoji: '💫' },
  { id: 19, gender: 'female', emoji: '🌸' },
  { id: 20, gender: 'female', emoji: '✨' },

  // ===== MALE (21–40) =====
  { id: 21, gender: 'male', emoji: '💈' },
  { id: 22, gender: 'male', emoji: '🔪' },
  { id: 23, gender: 'male', emoji: '👑' },
  { id: 24, gender: 'male', emoji: '✂️' },
  { id: 25, gender: 'male', emoji: '💨' },
  { id: 26, gender: 'male', emoji: '🥊' },
  { id: 27, gender: 'male', emoji: '⚡' },
  { id: 28, gender: 'male', emoji: '🍁' },
  { id: 29, gender: 'male', emoji: '🏛️' },
  { id: 30, gender: 'male', emoji: '🎯' },
  { id: 31, gender: 'male', emoji: '🌊' },
  { id: 32, gender: 'male', emoji: '🔌' },
  { id: 33, gender: 'male', emoji: '🦔' },
  { id: 34, gender: 'male', emoji: '🎩' },
  { id: 35, gender: 'male', emoji: '🎸' },
  { id: 36, gender: 'male', emoji: '🎾' },
  { id: 37, gender: 'male', emoji: '📦' },
  { id: 38, gender: 'male', emoji: '🎨' },
  { id: 39, gender: 'male', emoji: '🦁' },
  { id: 40, gender: 'male', emoji: '👔' },
] as const;

export const FEMALE_HAIRSTYLES = HAIRSTYLES_UI.filter(h => h.gender === 'female');
export const MALE_HAIRSTYLES = HAIRSTYLES_UI.filter(h => h.gender === 'male');

/** O(1) lookup by id. */
export const HAIRSTYLES_UI_BY_ID: ReadonlyMap<number, HairstyleListItem> =
  new Map(HAIRSTYLES_UI.map(h => [h.id, h]));

export function isValidStyleId(id: unknown): id is number {
  return typeof id === 'number' && HAIRSTYLES_UI_BY_ID.has(id);
}

/**
 * Canonical English name — used ONLY for server-side debug/analytics
 * (`Generation.styleName` / `TransformResult.style`, ADR-010 / D3).
 * NEVER render this in UI — UI resolves display names from the i18n
 * dictionary via `id`, not from this map.
 */
export const HAIRSTYLE_CANONICAL_NAME_EN: ReadonlyMap<number, string> = new Map([
  [1, 'Classic Bob'], [2, 'Long Bob (Lob)'], [3, 'Pixie'], [4, 'Hollywood Waves'],
  [5, 'Cascade'], [6, 'Beach Waves'], [7, 'Shag'], [8, 'Long Straight'],
  [9, 'Afro Curls'], [10, 'French Braid'], [11, 'Messy Bun'], [12, 'High Ponytail'],
  [13, 'Boxer Braids'], [14, 'Half-Up Half-Down'], [15, 'Low Bun'], [16, 'Asymmetrical Bob'],
  [17, 'Retro Waves'], [18, 'Curtain Bangs'], [19, 'Voluminous Curls'], [20, 'Sleek Low Ponytail'],
  [21, 'Fade'], [22, 'Undercut'], [23, 'Pompadour'], [24, 'Textured Crop'],
  [25, 'Quiff'], [26, 'Box Cut'], [27, 'Half Box'], [28, 'Taper Cut'],
  [29, 'Caesar Cut'], [30, 'Man Bun'], [31, 'Textured Crop (long)'], [32, 'Buzz Cut'],
  [33, 'Crew Cut'], [34, 'British Cut'], [35, 'Grunge'], [36, 'Tennis Cut'],
  [37, 'Flat Top'], [38, 'Fade with Design'], [39, 'Long Hair (male)'], [40, 'Side Part'],
]);
