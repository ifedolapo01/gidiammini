import { describe, it, expect } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  cursorParams,
  nextCursorFrom,
  NO_CURSOR,
} from './product-cursor';

const ID = '3f1a2b4c-5d6e-4f70-8901-a2b3c4d5e6f7';

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a cursor', () => {
    const cursor = { soldOut: false, value: '2026-09-02T23:47:40.123456+00:00', id: ID };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('survives a non-ASCII sort value — product names are free text', () => {
    const cursor = { soldOut: false, value: 'Röbe — Écru', id: ID };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('produces a URL-safe string needing no escaping', () => {
    const encoded = encodeCursor({ soldOut: false, value: '~~~???///+++', id: ID });
    expect(encoded).toBe(encodeURIComponent(encoded));
  });

  it('returns null for anything malformed rather than throwing', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('not-base64!!')).toBeNull();
    // Valid base64, but not a cursor.
    expect(decodeCursor(btoa('{"hello":"world"}'))).toBeNull();
  });

  it('rejects an id that is not a uuid, so it never reaches Postgres as one', () => {
    const forged = btoa(JSON.stringify({ o: false, v: '1', i: "'; drop table products; --" }));
    expect(decodeCursor(forged)).toBeNull();
  });
});

describe('cursorParams', () => {
  it('sends nothing when there is no cursor', () => {
    expect(cursorParams('newest', null)).toEqual(NO_CURSOR);
  });

  it('fills only the column its sort uses', () => {
    const cursor = { soldOut: false, value: '5000', id: ID };
    expect(cursorParams('price_asc', cursor)).toEqual({
      ...NO_CURSOR,
      p_cursor_id: ID,
      p_cursor_sold_out: false,
      p_cursor_price: 5000,
    });

    expect(cursorParams('best_selling', { soldOut: false, value: '42', id: ID })).toEqual({
      ...NO_CURSOR,
      p_cursor_id: ID,
      p_cursor_sold_out: false,
      p_cursor_sold: 42,
    });

    expect(cursorParams('name', { soldOut: false, value: 'Baby Gown', id: ID })).toEqual({
      ...NO_CURSOR,
      p_cursor_id: ID,
      p_cursor_sold_out: false,
      p_cursor_name: 'Baby Gown',
    });
  });

  it('falls back to the first page when the cursor does not fit the sort', () => {
    // The shopper changed sort while holding a name-shaped cursor.
    expect(cursorParams('price_asc', { soldOut: false, value: 'Baby Gown', id: ID })).toEqual(NO_CURSOR);
    expect(cursorParams('best_selling', { soldOut: false, value: 'Baby Gown', id: ID })).toEqual(NO_CURSOR);
    expect(cursorParams('newest', { soldOut: false, value: 'not-a-date', id: ID })).toEqual(NO_CURSOR);
  });

  it('treats an unrecognised sort as newest', () => {
    const cursor = { soldOut: false, value: '2026-09-02T23:47:40Z', id: ID };
    expect(cursorParams('newest', cursor).p_cursor_created).toBe(cursor.value);
  });
});

describe('nextCursorFrom', () => {
  const row = (id: string, sortValue: string, stock = 5) => ({ id, stock, sort_value: sortValue });

  it('returns null on a short page — there is nothing after it', () => {
    expect(nextCursorFrom([row(ID, '1')], 24)).toBeNull();
  });

  it('points at the last row of a full page', () => {
    const rows = Array.from({ length: 3 }, (_, i) => row(ID, String(i)));
    const cursor = nextCursorFrom(rows, 3);
    expect(decodeCursor(cursor)).toEqual({ soldOut: false, value: '2', id: ID });
  });

  it('records that the page ended in the sold-out block', () => {
    const rows = [row(ID, '0', 5), row(ID, '1', 0)];
    expect(decodeCursor(nextCursorFrom(rows, 2))?.soldOut).toBe(true);
  });

  it('returns null when the last row carries no sort key', () => {
    const rows = [{ id: ID, stock: 1, sort_value: null }];
    expect(nextCursorFrom(rows, 1)).toBeNull();
  });
});
