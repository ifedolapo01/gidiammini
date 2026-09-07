/**
 * COMMERCE layer — "you bought this a while ago, they've probably grown". Pure.
 *
 * Built on the same chart resolution as size-recommendation.ts: a past order
 * line is treated as a one-item product (its own `sizing_type`/`category`,
 * `sizes: [size]`) so chartForProduct() and matchedChartRows() answer exactly
 * as they would for the live product page, with no second lookup of the
 * product itself. That is also why this never imports account-query.ts —
 * account-query is server-only and this has to stay a plain function a test
 * can call directly, with no Supabase client anywhere near it.
 *
 * WHEN IS "ENOUGH TIME" HAS ENOUGH TIME PASSED
 *
 * Bands are not the same width — baby bands run 1-6 months, kids bands run a
 * year — so a fixed "3 months later" threshold would nag a kids customer
 * every quarter and miss half of a newborn's growth spurt. Instead the
 * current band's own width sets the threshold: once roughly half of it has
 * elapsed, the child is plausibly closer to the next band than the one they
 * were bought. That is a guess, not a growth chart, so it is stated as one —
 * see the copy in GrowthPromptCard.
 */
import { differenceInCalendarMonths } from 'date-fns';
import { chartForProduct, matchedChartRows } from './size-guide';
import { rowAgeRangeMonths, shouldOfferSizeRecommendation } from './size-recommendation';
import type { Product } from '@/types/product';

/** One past order line, reduced to what deciding a prompt needs. */
export interface GrowthPromptLine {
  sizing_type: Product['sizing_type'];
  category?: string | null;
  size: string | null;
  /** ISO timestamp — the order's created_at. */
  createdAt: string;
  productName?: string | null;
}

export interface GrowthPrompt {
  productName?: string;
  boughtSize: string;
  boughtDate: string;
  suggestedNextSize: string;
  monthsElapsed: number;
}

/** A default for the one band whose width the parser can't read from its own
 *  label (shouldn't happen for baby/kids rows, but a stray custom row must
 *  not throw). Three months matches the baby chart's typical band. */
const FALLBACK_BAND_WIDTH_MONTHS = 3;

function promptForLine(line: GrowthPromptLine, now: Date): GrowthPrompt | null {
  if (!line.size) return null;

  const product = { sizing_type: line.sizing_type, category: line.category, sizes: [line.size] };
  if (!shouldOfferSizeRecommendation(product)) return null;

  const chart = chartForProduct(product);
  const [label] = matchedChartRows(chart, [line.size]);
  if (!label) return null;

  const currentIndex = chart.rows.findIndex((row) => row.label === label);
  if (currentIndex === -1 || currentIndex === chart.rows.length - 1) return null;

  const monthsElapsed = differenceInCalendarMonths(now, new Date(line.createdAt));
  if (!Number.isFinite(monthsElapsed) || monthsElapsed < 0) return null;

  const band = rowAgeRangeMonths(chart.rows[currentIndex]);
  const bandWidth = band ? Math.max(band[1] - band[0], 1) : FALLBACK_BAND_WIDTH_MONTHS;
  const threshold = Math.max(1, bandWidth / 2);
  if (monthsElapsed < threshold) return null;

  return {
    productName: line.productName ?? undefined,
    boughtSize: line.size,
    boughtDate: line.createdAt,
    suggestedNextSize: chart.rows[currentIndex + 1].label,
    monthsElapsed,
  };
}

/**
 * At most one prompt, from the most recently bought line that qualifies —
 * the newest purchase is the one a parent's current stock of clothes is
 * actually built around, so it is the most useful thing to ask "still fits?"
 * about. Returns null when nothing in the history qualifies.
 */
export function findGrowthPrompt(lines: GrowthPromptLine[], now: Date = new Date()): GrowthPrompt | null {
  const sorted = [...lines].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (const line of sorted) {
    const prompt = promptForLine(line, now);
    if (prompt) return prompt;
  }

  return null;
}
