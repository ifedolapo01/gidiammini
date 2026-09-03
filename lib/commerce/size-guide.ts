/**
 * COMMERCE layer — which size chart a product needs, and how its own sizes map onto it.
 *
 * Pure: no React, no database. Two jobs.
 *
 * CHOOSING THE CHART
 *
 * Keyed off sizing_type, which the product model has always carried and
 * nothing has ever read. 'age' picks between the baby and kids tables by
 * looking at the sizes the product actually sells — a product offering "0-3
 * months" and one offering "7-8 years" both say 'age' and need different
 * tables. There is one fallback: a product in the maternity category whose
 * sizing_type was never set gets the maternity chart anyway, so existing rows
 * are right without an admin editing every one of them.
 *
 * MATCHING THE ROWS
 *
 * Sizes are free text typed into an admin form — "0-3 months", "0-3M",
 * "3-6m", "2T". Matching them to chart rows is what lets the guide highlight
 * the bands this product is actually sold in, which is the difference between
 * a reference table and an answer to "which of these should I buy".
 */
import { SIZE_CHARTS, type SizeChart } from '@/lib/data/size-charts';

export type SizingType = 'size' | 'age' | 'maternity';
export type FitRating = 'runs_small' | 'true_to_size' | 'runs_large';

/** A size string as typed, reduced to something comparable with an alias. */
function normalise(size: string): string {
  return size
    .trim()
    .toLowerCase()
    // "0-3 mths" and "0-3 mo" are the same band as "0-3 months".
    .replace(/\b(mths|mth|mos|mo)\b/g, 'months')
    .replace(/\b(yrs|yr)\b/g, 'years')
    // Collapse the spacing people put around the dash: "0 - 3" → "0-3".
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ');
}

/** True when this size string is a month-based band ("0-3 months", "18m"). */
function looksLikeMonths(size: string): boolean {
  const value = normalise(size);
  if (/months/.test(value)) return true;
  // "3m", "18m" — a number followed by a bare m, not "m" alone (that is Medium).
  return /^\d+\s*m$/.test(value) || /^\d+-\d+\s*m$/.test(value);
}

/** True when it is a year-based band ("2-3 years", "4y", "2t", or a bare number). */
function looksLikeYears(size: string): boolean {
  const value = normalise(size);
  if (/years/.test(value)) return true;
  return /^\d+\s*(y|t)$/.test(value) || /^\d+-\d+\s*(y|t)?$/.test(value) || /^\d+$/.test(value);
}

export interface ProductSizing {
  sizing_type?: SizingType | 'size' | 'age' | null;
  category?: string | null;
  sizes?: string[] | null;
}

/**
 * The chart to show for this product.
 *
 * Never null: every product that has sizes at all has a chart that says
 * something useful, and "no guide available" is the state this whole feature
 * exists to remove.
 */
export function chartForProduct(product: ProductSizing): SizeChart {
  const sizes = product.sizes ?? [];

  if (product.sizing_type === 'maternity') return SIZE_CHARTS.maternity;

  // The fallback for stock that predates the maternity sizing type.
  if (product.sizing_type !== 'age' && product.category === 'maternity') {
    return SIZE_CHARTS.maternity;
  }

  if (product.sizing_type === 'age') {
    // Months anywhere means this is baby stock. A product spanning both — "18-24
    // months" up to "3 years" — is a baby product with a top end, and the baby
    // table's last row covers 2T.
    return sizes.some(looksLikeMonths) ? SIZE_CHARTS.baby : SIZE_CHARTS.kids;
  }

  // sizing_type 'size': letter sizes, unless the sizes are plainly age bands
  // typed into a product whose type was never switched over.
  if (sizes.length > 0 && sizes.every((size) => looksLikeMonths(size))) return SIZE_CHARTS.baby;
  if (sizes.length > 0 && sizes.every((size) => looksLikeYears(size))) return SIZE_CHARTS.kids;

  return SIZE_CHARTS.letter;
}

/**
 * Which of the chart's rows this product actually sells, by row label.
 *
 * A Set rather than a filtered chart: the guide shows the whole table — a
 * parent needs the neighbouring bands to judge whether to size up — and marks
 * the rows that can be bought here.
 */
export function matchedChartRows(chart: SizeChart, sizes: readonly string[]): Set<string> {
  const matched = new Set<string>();

  for (const size of sizes) {
    const value = normalise(size);
    if (!value) continue;

    const row = chart.rows.find(
      (candidate) => candidate.label.toLowerCase() === value || candidate.aliases.includes(value)
    );
    if (row) matched.add(row.label);
  }

  return matched;
}

const FIT_LABELS: Record<FitRating, string> = {
  runs_small: 'Runs small',
  true_to_size: 'True to size',
  runs_large: 'Runs large',
};

/** The advice that follows from the rating. The label alone leaves the parent
 *  to work out what to do about it. */
const FIT_ADVICE: Record<FitRating, string> = {
  runs_small: 'We suggest choosing the next size up.',
  true_to_size: 'Choose the size that matches your measurements.',
  runs_large: 'We suggest choosing the next size down.',
};

export function isFitRating(value: unknown): value is FitRating {
  return value === 'runs_small' || value === 'true_to_size' || value === 'runs_large';
}

export function fitLabel(rating: FitRating): string {
  return FIT_LABELS[rating];
}

export function fitAdvice(rating: FitRating): string {
  return FIT_ADVICE[rating];
}

/** The label the selector puts above the buttons. */
export function sizeSelectorLabel(sizingType: ProductSizing['sizing_type']): string {
  return sizingType === 'age' ? 'Age' : 'Size';
}
