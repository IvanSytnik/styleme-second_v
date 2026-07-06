/**
 * Opaque keyset-pagination cursor codec (extracted from db/generations.ts
 * in Day 8 for direct unit testing — pure functions, zero dependencies).
 *
 * Cursor = base64url(`${createdAt}|${id}`). Encoded so clients can't parse
 * or forge it casually; the server treats it as a bearer token that resolves
 * to a `(created_at < X) OR (created_at = X AND id < Y)` predicate for
 * stable pagination even when many rows share the same second.
 */

export interface DecodedCursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sepIdx = raw.indexOf('|');
    if (sepIdx <= 0) return null;
    const createdAt = raw.slice(0, sepIdx);
    const id = raw.slice(sepIdx + 1);
    if (!createdAt || !id) return null;
    // Basic sanity — must parse as date, id must be uuid-ish
    if (Number.isNaN(Date.parse(createdAt))) return null;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
