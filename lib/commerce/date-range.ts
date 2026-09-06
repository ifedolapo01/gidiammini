/**
 * COMMERCE layer — the reporting window, and the window before it. Pure.
 *
 * The dashboard's numbers were all-time, which meant none of them could be
 * compared to anything: "₦2.4m" cannot answer whether this week was good. A
 * figure with nothing beside it is not information, so every range here comes
 * with the equal-length period immediately before it, and every card shows the
 * change between the two.
 *
 * WHY THE PREVIOUS PERIOD IS THE PRECEDING ONE, NOT THE SAME DATES LAST YEAR
 *
 * Year-on-year is the better comparison for a shop with years of history and
 * a seasonal pattern. This one has neither yet. Against last year, most cards
 * would read "no data"; against last week, every card says something true
 * today. When there is enough history for seasonality to mean anything, adding
 * a second comparison is a change to this file alone.
 *
 * DAY BOUNDARIES ARE UTC
 *
 * Everything stored is UTC and every other aggregation in this codebase
 * (dashboard-analytics.ts, inventory-query.ts) buckets in UTC. A shop in Lagos
 * is UTC+1, so "today" here starts an hour before midnight local — worth
 * knowing, and far better than two modules disagreeing about which day an
 * order fell in.
 */

export const RANGE_PRESETS = [7, 30, 90, 365] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const DEFAULT_RANGE: RangePreset = 30;

export interface DateRange {
  /** Inclusive, at 00:00 UTC. */
  from: string;
  /** Exclusive, so a range never double-counts the boundary day. */
  to: string;
  /** How many days it spans. */
  days: number;
}

export interface ComparedRange {
  current: DateRange;
  /** The equal-length window ending where `current` begins. */
  previous: DateRange;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Narrows an untrusted query parameter to a preset, falling back rather than
 *  refusing — a bad range in a URL should show the default dashboard, not an
 *  error page. */
export function parseRange(value: unknown): RangePreset {
  const parsed = Number(value);
  return (RANGE_PRESETS as readonly number[]).includes(parsed)
    ? (parsed as RangePreset)
    : DEFAULT_RANGE;
}

/**
 * The last `days` days, and the `days` before those.
 *
 * `to` is the start of tomorrow, so today is included in full — a range that
 * ended at "now" would compare a part-day against whole ones and make every
 * card look like a decline in the morning.
 */
export function rangeFor(days: RangePreset, now: Date = new Date()): ComparedRange {
  const endExclusive = new Date(startOfUtcDay(now).getTime() + DAY_MS);
  const currentStart = new Date(endExclusive.getTime() - days * DAY_MS);
  const previousStart = new Date(currentStart.getTime() - days * DAY_MS);

  return {
    current: { from: currentStart.toISOString(), to: endExclusive.toISOString(), days },
    previous: { from: previousStart.toISOString(), to: currentStart.toISOString(), days },
  };
}

/** How the range reads on the page and in a drill-through link's title. */
export function describeRange(days: RangePreset): string {
  if (days === 7) return 'Last 7 days';
  if (days === 30) return 'Last 30 days';
  if (days === 90) return 'Last 90 days';
  return 'Last 12 months';
}

/** What the comparison is against, said in full so nobody has to guess whether
 *  "+12%" means against last week or last year. */
export function describeComparison(days: RangePreset): string {
  if (days === 7) return 'vs previous 7 days';
  if (days === 30) return 'vs previous 30 days';
  if (days === 90) return 'vs previous 90 days';
  return 'vs previous 12 months';
}

/** True when an ISO timestamp falls inside a range. */
export function withinRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!iso) return false;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return false;
  return at >= Date.parse(range.from) && at < Date.parse(range.to);
}
