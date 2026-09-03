/**
 * COMMERCE layer — the keyset cursor for the product listing.
 *
 * A keyset page is "everything after this (sort key, id)". The sort key is a
 * price for one sort, a timestamp for another, and a sales count for a third —
 * and that last one is the reason this is opaque rather than a pair of readable
 * query values. `units_sold` has to travel in the cursor to page a best-selling
 * sort, but it is also a public statement of how much the store sells. Encoded,
 * it stays an implementation detail of paging instead of an API that reports
 * sales volume to anyone who reads a URL.
 *
 * Opaque, not secret. Anyone can decode it; nothing is trusted on the way back
 * in, and a cursor that does not fit its sort is discarded rather than
 * rejected, because the usual cause is a stale link, not an attack.
 *
 * Pure — no Buffer, so the same code runs in the route and in the browser.
 */
import type { SortValue } from './product-filters';

export interface ProductCursor {
  /**
   * Which block the last row was in. Sold-out products rank last under every
   * sort, so the block is the outermost sort key — without it, the first
   * "load more" after crossing into the sold-out section would jump back to
   * the in-stock rows and repeat them.
   */
  soldOut: boolean;
  /** The last row's sort key, as text. Its meaning depends on the sort. */
  value: string;
  /** The last row's id, breaking ties on an equal sort key. */
  id: string;
}

/** The cursor parameters list_products() takes, one column per sort family. */
export interface CursorParams {
  p_cursor_id: string | null;
  p_cursor_sold_out: boolean | null;
  p_cursor_price: number | null;
  p_cursor_sold: number | null;
  p_cursor_name: string | null;
  p_cursor_created: string | null;
}

export const NO_CURSOR: CursorParams = {
  p_cursor_id: null,
  p_cursor_sold_out: null,
  p_cursor_price: null,
  p_cursor_sold: null,
  p_cursor_name: null,
  p_cursor_created: null,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** base64url, so a cursor survives a query string without escaping. */
function toBase64Url(text: string): string {
  const base64 = btoa(unescape(encodeURIComponent(text)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // atob wants the padding back.
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return null;
  }
}

export function encodeCursor(cursor: ProductCursor): string {
  return toBase64Url(JSON.stringify({ o: cursor.soldOut, v: cursor.value, i: cursor.id }));
}

/**
 * Returns null for anything that is not a well-formed cursor — including a
 * cursor whose id is not a uuid, which would otherwise reach Postgres as one.
 */
export function decodeCursor(raw: string | null | undefined): ProductCursor | null {
  if (!raw) return null;

  const json = fromBase64Url(raw);
  if (json === null) return null;

  try {
    const parsed = JSON.parse(json);
    if (typeof parsed?.v !== 'string' || typeof parsed?.i !== 'string') return null;
    if (!UUID_PATTERN.test(parsed.i)) return null;
    // A cursor minted before sold-out products were listed carries no block.
    // Every one of them pointed into the in-stock section.
    return { soldOut: parsed.o === true, value: parsed.v, id: parsed.i };
  } catch {
    return null;
  }
}

/**
 * Spreads a cursor into the one typed parameter its sort actually uses.
 *
 * Typed columns rather than one value cast per sort: a `p_cursor::integer`
 * inside a CASE can be constant-folded by the planner even when its branch is
 * not taken, so a name-shaped cursor would fail while sorting by name.
 */
export function cursorParams(sort: SortValue, cursor: ProductCursor | null): CursorParams {
  if (!cursor) return NO_CURSOR;

  const base: CursorParams = {
    ...NO_CURSOR,
    p_cursor_id: cursor.id,
    p_cursor_sold_out: cursor.soldOut,
  };

  switch (sort) {
    case 'price_asc':
    case 'price_desc': {
      const price = Number(cursor.value);
      // A cursor from a different sort — the shopper changed sort with a stale
      // cursor in hand. Start from the top rather than pass NaN to Postgres.
      return Number.isFinite(price) ? { ...base, p_cursor_price: Math.trunc(price) } : NO_CURSOR;
    }
    case 'best_selling': {
      const sold = Number(cursor.value);
      return Number.isFinite(sold) ? { ...base, p_cursor_sold: Math.trunc(sold) } : NO_CURSOR;
    }
    case 'name':
      return { ...base, p_cursor_name: cursor.value };
    default: {
      // Postgres will parse the timestamp; reject only what is obviously not one.
      const parsed = Date.parse(cursor.value);
      return Number.isFinite(parsed) ? { ...base, p_cursor_created: cursor.value } : NO_CURSOR;
    }
  }
}

/** The cursor pointing just past a page, or null when the page was the last. */
export function nextCursorFrom(
  rows: Array<{ id: string; stock?: number; sort_value?: string | null }>,
  pageSize: number
): string | null {
  // A short page means the end of the set: there is nothing to point at.
  if (rows.length < pageSize) return null;

  const last = rows[rows.length - 1];
  if (!last || typeof last.sort_value !== 'string') return null;

  return encodeCursor({
    // Derived from the stock the row already carries rather than a column of
    // its own — the two could not disagree, and one fewer column crosses the
    // wire.
    soldOut: (last.stock ?? 0) <= 0,
    value: last.sort_value,
    id: last.id,
  });
}
