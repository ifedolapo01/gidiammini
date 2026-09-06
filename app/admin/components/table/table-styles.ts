/**
 * ADMIN layer — the class strings every admin table shares.
 *
 * These existed as private constants inside CustomerTable while six other
 * tables hand-wrote their own variants, which is why alignment and padding
 * disagreed from page to page. One definition, imported.
 *
 * THE NUMERIC RULE
 *
 * Money and counts get `tabular-nums` and right alignment, and they get both
 * or neither. Proportional digits are different widths, so a column of prices
 * in the body font does not line up on the decimal — comparing ₦12,500 against
 * ₦9,800 down a page of 200 rows means reading each one rather than seeing the
 * shape of the number. Right alignment puts the units under the units.
 */
import { cn } from '@/lib/utils';

/** A header cell. */
export const TH =
  'px-4 py-3 text-left text-caption-md font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap';

/** A body cell at comfortable density; see rowPadding for the compact one. */
export const TD = 'px-4 py-3 align-middle';

/** Money, counts, stock — anything the eye compares down a column. */
export const NUMERIC = 'text-right tabular-nums';

/**
 * A sticky header row. The header scrolls out of a long list otherwise, and by
 * row 40 the columns are unlabelled.
 *
 * MUST be paired with TABLE_SCROLL on the wrapper — see below.
 *
 * The background is opaque on purpose: rows passing underneath a translucent
 * header are unreadable. The inset shadow draws the bottom rule, because a
 * `border-b` on a sticky element does not travel with it in every browser.
 */
export const STICKY_HEAD = 'sticky top-0 z-10 bg-background-secondary shadow-[inset_0_-1px_0_var(--border)]';

/**
 * The scroll container a sticky header needs.
 *
 * `overflow-x-auto` alone is not enough and is in fact the trap: when one axis
 * is not `visible` the other computes to `auto` too, so the wrapper becomes a
 * scroll container on both axes — but with `height: auto` it never actually
 * scrolls vertically. A `sticky top-0` header inside it therefore has no
 * scrollport to stick within and simply rides the page off the top, looking
 * exactly like the bug it was meant to fix.
 *
 * Capping the height gives it one. The table scrolls inside the cap and the
 * header holds; below the cap the page scrolls as usual.
 *
 * Pair with `tabIndex={0}` and a labelled `role="region"` on the same element:
 * a scrollable box that cannot be reached by keyboard cannot be scrolled by
 * keyboard.
 */
export const TABLE_SCROLL = 'max-h-[70vh] overflow-auto';

/** Hover feedback, so the eye keeps its place crossing a wide row. */
export const ROW_HOVER = 'transition-colors hover:bg-surface-hover';

export type TableDensity = 'comfortable' | 'compact';

/**
 * Cell padding for the chosen density. Compact fits roughly a third more rows
 * on screen, which is the difference between one screenful and two when
 * reconciling stock.
 */
export function rowPadding(density: TableDensity): string {
  return density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3';
}

/** A body cell at the given density, plus whatever else the column needs. */
export function cell(density: TableDensity, ...extra: Array<string | false | undefined>): string {
  return cn(rowPadding(density), 'align-middle', ...extra);
}

/** A numeric body cell — the two rules above, together, always. */
export function numericCell(density: TableDensity, ...extra: Array<string | false | undefined>): string {
  return cn(rowPadding(density), 'align-middle', NUMERIC, ...extra);
}
