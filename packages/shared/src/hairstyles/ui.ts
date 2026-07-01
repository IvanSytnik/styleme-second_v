/**
 * UI-facing hairstyle catalog.
 *
 * Contains only display data (id, name, gender, emoji).
 * Prompts live in ./prompts.ts and are server-only — never import that
 * file from any browser-facing code (separate subpath export enforces it).
 */

import type { HairstyleListItem } from '../types/api';

export const HAIRSTYLES_UI: readonly HairstyleListItem[] = [
  // ===== FEMALE (1–20) =====
  { id: 1,  name: 'Классическое каре',      gender: 'female', emoji: '💇‍♀️' },
  { id: 2,  name: 'Удлинённый боб (Лоб)',   gender: 'female', emoji: '✨' },
  { id: 3,  name: 'Пикси',                  gender: 'female', emoji: '⭐' },
  { id: 4,  name: 'Голливудские локоны',    gender: 'female', emoji: '🌟' },
  { id: 5,  name: 'Каскад',                 gender: 'female', emoji: '🌊' },
  { id: 6,  name: 'Пляжные волны',          gender: 'female', emoji: '🏖️' },
  { id: 7,  name: 'Шэг',                    gender: 'female', emoji: '🔥' },
  { id: 8,  name: 'Прямые длинные',         gender: 'female', emoji: '💎' },
  { id: 9,  name: 'Кудри афро',             gender: 'female', emoji: '🌀' },
  { id: 10, name: 'Французская коса',       gender: 'female', emoji: '🥐' },
  { id: 11, name: 'Небрежный пучок',        gender: 'female', emoji: '🎀' },
  { id: 12, name: 'Конский хвост',          gender: 'female', emoji: '🐴' },
  { id: 13, name: 'Косы боксёр',            gender: 'female', emoji: '🥊' },
  { id: 14, name: 'Мальвинка',              gender: 'female', emoji: '👸' },
  { id: 15, name: 'Низкий пучок',           gender: 'female', emoji: '🎭' },
  { id: 16, name: 'Асимметричный боб',      gender: 'female', emoji: '📐' },
  { id: 17, name: 'Ретро волны',            gender: 'female', emoji: '🎬' },
  { id: 18, name: 'Длинная чёлка',          gender: 'female', emoji: '💫' },
  { id: 19, name: 'Объёмные локоны',        gender: 'female', emoji: '🌸' },
  { id: 20, name: 'Гладкий хвост',          gender: 'female', emoji: '✨' },

  // ===== MALE (21–40) =====
  { id: 21, name: 'Фейд',                   gender: 'male',   emoji: '💈' },
  { id: 22, name: 'Андеркат',               gender: 'male',   emoji: '🔪' },
  { id: 23, name: 'Помпадур',               gender: 'male',   emoji: '👑' },
  { id: 24, name: 'Кроп',                   gender: 'male',   emoji: '✂️' },
  { id: 25, name: 'Квифф',                  gender: 'male',   emoji: '💨' },
  { id: 26, name: 'Бокс',                   gender: 'male',   emoji: '🥊' },
  { id: 27, name: 'Полубокс',               gender: 'male',   emoji: '⚡' },
  { id: 28, name: 'Канадка',                gender: 'male',   emoji: '🍁' },
  { id: 29, name: 'Цезарь',                 gender: 'male',   emoji: '🏛️' },
  { id: 30, name: 'Мужской пучок',          gender: 'male',   emoji: '🎯' },
  { id: 31, name: 'Текстурная стрижка',     gender: 'male',   emoji: '🌊' },
  { id: 32, name: 'Под машинку',            gender: 'male',   emoji: '🔌' },
  { id: 33, name: 'Ёжик',                   gender: 'male',   emoji: '🦔' },
  { id: 34, name: 'Британка',               gender: 'male',   emoji: '🎩' },
  { id: 35, name: 'Гранж',                  gender: 'male',   emoji: '🎸' },
  { id: 36, name: 'Теннис',                 gender: 'male',   emoji: '🎾' },
  { id: 37, name: 'Площадка',               gender: 'male',   emoji: '📦' },
  { id: 38, name: 'Фейд с узором',          gender: 'male',   emoji: '🎨' },
  { id: 39, name: 'Длинные мужские',        gender: 'male',   emoji: '🦁' },
  { id: 40, name: 'Боковой пробор',         gender: 'male',   emoji: '👔' },
] as const;

export const FEMALE_HAIRSTYLES = HAIRSTYLES_UI.filter(h => h.gender === 'female');
export const MALE_HAIRSTYLES = HAIRSTYLES_UI.filter(h => h.gender === 'male');

/** O(1) lookup by id. */
export const HAIRSTYLES_UI_BY_ID: ReadonlyMap<number, HairstyleListItem> =
  new Map(HAIRSTYLES_UI.map(h => [h.id, h]));

export function isValidStyleId(id: unknown): id is number {
  return typeof id === 'number' && HAIRSTYLES_UI_BY_ID.has(id);
}
