/**
 * COMMERCE layer — turning an age or a measurement into a size to buy. Pure.
 *
 * Reuses the same chart-selection and alias-matching that the size guide
 * already does (lib/commerce/size-guide.ts) rather than a second copy of it —
 * the two must always agree on which chart a product uses and which of its
 * sizes is which row, or the guide and the recommender would tell a parent two
 * different things about the same garment.
 *
 * ELIGIBILITY IS DECIDED BY THE CHART, NOT THE FIELD
 *
 * `sizing_type` alone is not enough: chartForProduct() already falls back to
 * the baby/kids tables for stock whose `sizing_type` was never switched over
 * from 'size'. A questionnaire keyed off the raw field would stay hidden on
 * exactly the products that most need it. So eligibility here is "does this
 * product's resolved chart use age/height bands" (baby, kids) — letter and
 * maternity charts don't have a row a numeric answer can be dropped into.
 *
 * AGE AND HEIGHT ARE PARSED FROM THE SAME TEXT THE GUIDE ALREADY RENDERS
 *
 * Baby and kids row labels are consistently "X-Y months" / "X-Y years" (the
 * one exception, "Newborn", is handled explicitly), and both charts put
 * Height in column 0 — so one range parser covers age labels and every
 * measurement column without a chart-specific table to keep in sync.
 */
import { chartForProduct, matchedChartRows, type FitRating, type ProductSizing } from './size-guide';
import type { SizeChart, SizeChartRow } from '@/lib/data/size-charts';

export interface SizeRecommendationInput {
  ageMonths?: number;
  heightCm?: number;
  weightKg?: number;
  /**
   * A known fit signal — the admin's own claim, or the aggregate of customer
   * fit feedback (rating-math.ts's dominantFitSignal) — nudging the
   * age/height answer by one row before it is mapped to stock. 'runs_small'
   * moves the target up a row, 'runs_large' moves it down; 'true_to_size' and
   * undefined leave the answer alone. This is the same three-value vocabulary
   * FitNote already shows under the size buttons, applied here instead of
   * just displayed.
   */
  fitRating?: FitRating;
}

export interface SizeRecommendation {
  /** An actual size this product stocks. */
  recommendedSize: string;
  /** The chart row the answer landed on, for display ("6-9 months"). */
  idealLabel: string;
  /** False when the ideal band isn't stocked and this is the nearest one that is. */
  exactMatch: boolean;
}

const GROWTH_CHART_IDS: ReadonlySet<SizeChart['id']> = new Set(['baby', 'kids']);

/** Whether this product's chart is one a numeric answer can be placed on. */
export function shouldOfferSizeRecommendation(product: ProductSizing): boolean {
  return GROWTH_CHART_IDS.has(chartForProduct(product).id);
}

/** An age span in months parsed out of a label — a chart row's own label, or
 *  a product's raw size string. The same two forms cover both: "X-Y months",
 *  "X-Y years". "Newborn" is younger than the first numbered band and short —
 *  a few weeks — so it is given a narrow span rather than a range parsed from
 *  its name. Unanchored (no ^/$) so it also matches a size string that isn't
 *  *only* the range, e.g. a stray "Age: 3-6 months" label. */
function parseAgeRangeMonths(label: string): [number, number] | null {
  if (label.trim().toLowerCase() === 'newborn') return [0, 1];
  const months = label.match(/(\d+)\s*-\s*(\d+)\s*months?\b/i);
  if (months) return [Number(months[1]), Number(months[2])];
  const years = label.match(/(\d+)\s*-\s*(\d+)\s*years?\b/i);
  if (years) return [Number(years[1]) * 12, Number(years[2]) * 12];
  return null;
}

/** The row's age span in months, or null when its label isn't one of the two
 *  standard forms. */
export function rowAgeRangeMonths(row: SizeChartRow): [number, number] | null {
  return parseAgeRangeMonths(row.label);
}

/** The leading numeric range in a values-column cell: "58-66 cm" → [58, 66],
 *  "up to 3.5 kg" → [0, 3.5]. Unit-agnostic — the same parser reads height,
 *  weight or chest cells, since it only looks at the numbers. */
function parseNumericRange(text: string): [number, number] | null {
  const upTo = text.match(/up to\s*([\d.]+)/i);
  if (upTo) return [0, Number(upTo[1])];
  const range = text.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (range) return [Number(range[1]), Number(range[2])];
  return null;
}

/** The row whose range contains `value`, clamping outliers to the nearest
 *  end rather than returning nothing — a shopper who mistypes a height a
 *  centimetre past the top band still gets an answer. */
function pickBand(bands: Array<{ row: SizeChartRow; range: [number, number] }>, value: number): SizeChartRow | null {
  if (bands.length === 0) return null;
  for (let i = 0; i < bands.length; i++) {
    const [min, max] = bands[i].range;
    const isLast = i === bands.length - 1;
    if (value >= min && (value < max || isLast)) return bands[i].row;
  }
  return value < bands[0].range[0] ? bands[0].row : bands[bands.length - 1].row;
}

function findRowByAge(chart: SizeChart, ageMonths: number): SizeChartRow | null {
  const bands = chart.rows
    .map((row) => ({ row, range: rowAgeRangeMonths(row) }))
    .filter((b): b is { row: SizeChartRow; range: [number, number] } => b.range !== null);
  return pickBand(bands, ageMonths);
}

/**
 * Height decides the band; weight only overrules it when the two disagree,
 * and then only toward the larger band — the same advice the chart's own
 * note already gives a parent choosing between two rows by hand.
 */
function findRowByHeight(chart: SizeChart, heightCm: number, weightKg?: number): SizeChartRow | null {
  const heightBands = chart.rows
    .map((row) => ({ row, range: parseNumericRange(row.values[0]) }))
    .filter((b): b is { row: SizeChartRow; range: [number, number] } => b.range !== null);
  const byHeight = pickBand(heightBands, heightCm);
  if (byHeight === null || weightKg === undefined) return byHeight;

  const weightIndex = chart.columns.indexOf('Weight');
  if (weightIndex === -1) return byHeight;

  const weightBands = chart.rows
    .map((row) => ({ row, range: parseNumericRange(row.values[weightIndex]) }))
    .filter((b): b is { row: SizeChartRow; range: [number, number] } => b.range !== null);
  const byWeight = pickBand(weightBands, weightKg);
  if (!byWeight || byWeight === byHeight) return byHeight;

  const heightIdx = chart.rows.indexOf(byHeight);
  const weightIdx = chart.rows.indexOf(byWeight);
  return weightIdx > heightIdx ? byWeight : byHeight;
}

/** Which chart row a stocked size string maps to.
 *
 * Tries the size guide's own alias matching first — the aliases are the
 * standard spellings of the standard bands ("0-3 months", "0-3m"...). A shop
 * that stocks a size cut to a different split ("1-2 Months", "3-5 Months")
 * has nothing in that list to match, and used to come back with no row at
 * all — not "no chart", just no answer, on stock the questionnaire was
 * built for. So a size with no alias match falls back to its own parsed age
 * range, landing on whichever standard row its midpoint falls in. */
function rowForSize(chart: SizeChart, size: string): SizeChartRow | null {
  const labels = matchedChartRows(chart, [size]);
  if (labels.size > 0) {
    const [label] = labels;
    return chart.rows.find((row) => row.label === label) ?? null;
  }

  const ownRange = parseAgeRangeMonths(size);
  if (!ownRange) return null;

  const bands = chart.rows
    .map((row) => ({ row, range: rowAgeRangeMonths(row) }))
    .filter((b): b is { row: SizeChartRow; range: [number, number] } => b.range !== null);
  return pickBand(bands, (ownRange[0] + ownRange[1]) / 2);
}

/** The stocked size to recommend for a target row: that row's own size if
 *  the product sells it, otherwise whichever stocked size sits on the
 *  nearest row (ties broken toward the larger size — a child grows). */
function mapRowToStockedSize(chart: SizeChart, sizes: readonly string[], target: SizeChartRow): SizeRecommendation | null {
  const targetIndex = chart.rows.indexOf(target);

  let best: { size: string; index: number } | null = null;
  for (const size of sizes) {
    const row = rowForSize(chart, size);
    if (!row) continue;
    const index = chart.rows.indexOf(row);
    if (index === targetIndex) {
      return { recommendedSize: size, idealLabel: target.label, exactMatch: true };
    }
    const distance = Math.abs(index - targetIndex);
    const bestDistance = best ? Math.abs(best.index - targetIndex) : Infinity;
    if (!best || distance < bestDistance || (distance === bestDistance && index > best.index)) {
      best = { size, index };
    }
  }

  return best ? { recommendedSize: best.size, idealLabel: target.label, exactMatch: false } : null;
}

/** Shifts the target row by one band toward the size a known fit signal
 *  points at, clamped to the chart's own ends. 'true_to_size' and no signal
 *  both leave the age/height answer exactly where it landed. */
function applyFitOffset(chart: SizeChart, row: SizeChartRow, fitRating?: FitRating): SizeChartRow {
  if (fitRating !== 'runs_small' && fitRating !== 'runs_large') return row;

  const offset = fitRating === 'runs_small' ? 1 : -1;
  const index = chart.rows.indexOf(row);
  const nextIndex = Math.min(chart.rows.length - 1, Math.max(0, index + offset));
  return chart.rows[nextIndex];
}

/**
 * The size to recommend, given an age or a height (weight is a refinement,
 * never used alone). Null covers three honest "no answer" cases: the
 * product's chart isn't age/height-banded, no input was given, or none of
 * the sizes this product stocks map to any row of its own chart.
 */
export function recommendSize(product: ProductSizing, input: SizeRecommendationInput): SizeRecommendation | null {
  if (!shouldOfferSizeRecommendation(product)) return null;

  const chart = chartForProduct(product);
  const sizes = product.sizes ?? [];
  if (sizes.length === 0) return null;

  const target = input.ageMonths !== undefined
    ? findRowByAge(chart, input.ageMonths)
    : input.heightCm !== undefined
      ? findRowByHeight(chart, input.heightCm, input.weightKg)
      : null;
  if (!target) return null;

  return mapRowToStockedSize(chart, sizes, applyFitOffset(chart, target, input.fitRating));
}
