/**
 * Cursor codec — pure-function unit tests. The codec is the trust boundary
 * of history pagination: whatever the client sends comes straight back into
 * a PostgREST `.or()` filter string, so decode must reject anything that
 * isn't exactly `base64url(ISO-date|uuid)`.
 */

import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor } from '../src/lib/cursor';

describe('cursor codec', () => {
  it('round-trips a valid (createdAt, id) pair', () => {
    const createdAt = '2026-07-05T12:34:56.789Z';
    const id = randomUUID();
    const decoded = decodeCursor(encodeCursor(createdAt, id));
    expect(decoded).toEqual({ createdAt, id });
  });

  it('rejects garbage that is not base64url', () => {
    expect(decodeCursor('%%%not-base64%%%')).toBeNull();
  });

  it('rejects payloads without a separator', () => {
    const cursor = Buffer.from('no-separator-here', 'utf8').toString('base64url');
    expect(decodeCursor(cursor)).toBeNull();
  });

  it('rejects empty createdAt or id parts', () => {
    const onlyId = Buffer.from(`|${randomUUID()}`, 'utf8').toString('base64url');
    const onlyDate = Buffer.from('2026-07-05T00:00:00Z|', 'utf8').toString('base64url');
    expect(decodeCursor(onlyId)).toBeNull();
    expect(decodeCursor(onlyDate)).toBeNull();
  });

  it('rejects non-date createdAt', () => {
    const cursor = Buffer.from(`not-a-date|${randomUUID()}`, 'utf8').toString('base64url');
    expect(decodeCursor(cursor)).toBeNull();
  });

  it('rejects non-uuid ids — the injection guard for the .or() filter', () => {
    // If this ever passes, an attacker can smuggle PostgREST operators
    // (commas, parens) into the pagination filter.
    const evil = `2026-07-05T00:00:00Z|1),user_id.neq.x,(1.eq.1`;
    const cursor = Buffer.from(evil, 'utf8').toString('base64url');
    expect(decodeCursor(cursor)).toBeNull();
  });

  it('uses lastIndexOf-free split correctly: uuid contains no pipe, date may not either', () => {
    // Defensive: dates with unusual but parseable formats still round-trip.
    const createdAt = '2026-07-05 12:00:00+00';
    const id = randomUUID();
    const decoded = decodeCursor(encodeCursor(createdAt, id));
    expect(decoded).toEqual({ createdAt, id });
  });
});
