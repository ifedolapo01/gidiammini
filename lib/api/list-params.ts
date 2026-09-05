/**
 * API layer — the pagination / sorting / search parameters every admin list
 * endpoint accepts, parsed in one place.
 *
 * Admin lists used to select every row and let the browser filter, sort and
 * count. That is fine at a hundred rows and fatal at five thousand: the JSON
 * parse alone freezes the tab, and a 60-second poll repeats it. Every list
 * endpoint now takes the same shape of query string so the database does the
 * work, and so the client hooks can share one implementation.
 */

export interface ListParamsSpec {
  /** Column names this endpoint will actually sort by. Anything else in the
   * query string falls back to `defaultSort` rather than reaching PostgREST —
   * an unrecognised sort column is a 400 from Supabase, not a useful error. */
  sortable: readonly string[];
  defaultSort: string;
  defaultDirection?: 'asc' | 'desc';
  defaultLimit?: number;
  /** Hard ceiling, so `?limit=100000` cannot recreate the problem this file
   * exists to solve. */
  maxLimit?: number;
}

export interface ListParams {
  page: number;
  limit: number;
  /** Inclusive row range for supabase `.range(from, to)`. */
  from: number;
  to: number;
  search: string;
  sort: string;
  ascending: boolean;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function positiveInt(raw: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function parseListParams(url: URL, spec: ListParamsSpec): ListParams {
  const maxLimit = spec.maxLimit ?? MAX_LIMIT;
  const limit = positiveInt(url.searchParams.get('limit'), spec.defaultLimit ?? DEFAULT_LIMIT, maxLimit);
  const page = positiveInt(url.searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER);

  const requestedSort = url.searchParams.get('sort') ?? '';
  const sort = spec.sortable.includes(requestedSort) ? requestedSort : spec.defaultSort;

  const requestedDirection = url.searchParams.get('direction');
  const direction = requestedDirection === 'asc' || requestedDirection === 'desc'
    ? requestedDirection
    : spec.defaultDirection ?? 'desc';

  const from = (page - 1) * limit;

  return {
    page,
    limit,
    from,
    to: from + limit - 1,
    search: (url.searchParams.get('search') ?? '').trim(),
    sort,
    ascending: direction === 'asc',
  };
}

export function listMeta(params: Pick<ListParams, 'page' | 'limit'>, total: number): ListMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasMore: params.page < totalPages,
  };
}

const FILTER_SYNTAX = new Set([',', '(', ')', '"', '\\', '%', '*']);

/**
 * Makes a user-typed search term safe to drop inside a PostgREST `.or()`
 * filter string.
 *
 * That string is parsed, not parameterised: a comma starts the next condition,
 * parentheses group, and a double quote opens a quoted value. A customer
 * searching for "Smith, J" would otherwise produce a malformed filter and a
 * 400 — or, with the wrong characters, a filter the caller did not write. The
 * structural characters are removed rather than escaped because none of them
 * are meaningful in a name, an email or an order number.
 */
export function sanitizeSearchTerm(term: string): string {
  // Written as a set rather than a regular expression so the backslash does
  // not need escaping twice over and mis-read as something else.
  return [...term]
    .map((character) => (FILTER_SYNTAX.has(character) ? ' ' : character))
    .join('')
    .trim()
    .slice(0, 100);
}

/** `col.ilike.*term*` for each column, joined for `.or()`. */
export function ilikeAcross(columns: readonly string[], term: string): string {
  const safe = sanitizeSearchTerm(term);
  return columns.map((column) => `${column}.ilike.*${safe}*`).join(',');
}
