/**
 * COMMERCE layer — putting a list of sizes in the order a person expects.
 *
 * The size facet gets its options from the database, which can only sort them
 * as text. Alphabetically that gives "L, M, S, XL, XS" and, worse for a store
 * selling baby clothes, "0-3 months, 12-18 months, 3-6 months" — the twelve
 * sorting before the three because "1" < "3". Neither is browsable.
 *
 * Three families, checked in order:
 *
 *   1. Letter sizes (XS…XXL, and the 2XL/3XL spelling of the same thing).
 *   2. Anything that starts with a number — "2", "2T", "0-3 months",
 *      "18 months". Sorted by that leading number, with a unit multiplier so
 *      "18 months" sorts below "2 years" rather than above it.
 *   3. Everything else, alphabetically, after both.
 *
 * Pure, so the awkward cases are testable directly.
 */

/** Canonical letter sizes, smallest first. Index is the rank. */
const LETTER_SIZES = ['xxxs', 'xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'];

/** "2xl" and "xxl" are the same size written two ways. */
function normaliseLetterSize(value: string): string {
  const match = /^([2-5])x(l|s)$/.exec(value);
  if (!match) return value;
  const [, count, axis] = match;
  return 'x'.repeat(Number(count)) + axis;
}

/** Months are the baby-clothes default; a bare number means years. */
const UNIT_MONTHS: Array<[RegExp, number]> = [
  [/\b(month|months|mo|mths)\b/, 1],
  [/\b(year|years|yr|yrs)\b/, 12],
];

function unitMultiplier(value: string): number {
  for (const [pattern, months] of UNIT_MONTHS) {
    if (pattern.test(value)) return months;
  }
  // "2T", "4" — toddler and children's sizing, already in years.
  return 12;
}

/**
 * A sortable rank. Lower comes first. Returns null for anything that is
 * neither a letter size nor numeric, which then falls back to alphabetical.
 */
function sizeRank(raw: string): number | null {
  const value = raw.trim().toLowerCase();
  if (value === '') return null;

  const letterIndex = LETTER_SIZES.indexOf(normaliseLetterSize(value));
  if (letterIndex !== -1) return letterIndex;

  // The first number in the string: "0-3 months" ranks by its 0, "18m" by 18.
  const leadingNumber = /^(\d+(?:\.\d+)?)/.exec(value);
  if (!leadingNumber) return null;

  // Offset past the letter block so a numeric size never interleaves with S/M/L.
  return LETTER_SIZES.length + Number(leadingNumber[1]) * unitMultiplier(value);
}

/** Comparator for Array.prototype.sort. */
export function compareSizes(a: string, b: string): number {
  const rankA = sizeRank(a);
  const rankB = sizeRank(b);

  if (rankA !== null && rankB !== null) {
    // Equal ranks means the same size spelled differently ("2xl" / "xxl") or
    // two bands sharing a lower bound; settle it alphabetically so the order
    // is at least stable.
    return rankA === rankB ? a.localeCompare(b) : rankA - rankB;
  }

  // Anything unrecognised sorts after everything recognised.
  if (rankA !== null) return -1;
  if (rankB !== null) return 1;
  return a.localeCompare(b);
}

/** A new array, sorted. */
export function sortSizes(sizes: readonly string[]): string[] {
  return [...sizes].sort(compareSizes);
}
