/**
 * COMMERCE layer — which sizes to buy more of, and which to stop buying. Pure.
 *
 * The buying decision a clothing shop makes over and over, and the one its
 * software never helps with: every delivery arrives as a size run somebody
 * guessed at, and the only feedback is a vague sense that newborn always ends
 * up on the sale rail while 6-12 months goes in a fortnight.
 *
 * THE NUMBER IS A RATIO, AND NOT THE OBVIOUS ONE
 *
 * "6-12 months sold 40 units" says nothing on its own — it may have sold most
 * because the shop stocked most of it. The obvious correction is
 *
 *     share of units sold / share of units stocked
 *
 * and it has a defect that matters in exactly the case a shop needs help with.
 * That ratio cannot exceed 1 / stockShare, so a size holding 98% of the
 * inventory is pinned within a couple of percent of 1.0 however badly it sells
 * — the report says "about right" about the very size that is burying the
 * shop. It detects under-buying and is nearly blind to over-buying.
 *
 * So the comparison is between sizes rather than against the pooled shop:
 *
 *     sellThrough(size) = sold / (sold + still on the shelf)
 *     demandIndex       = sellThrough(size) / mean sellThrough across sizes
 *
 * The mean is unweighted, which is the whole point — it is the average size's
 * behaviour, not the average unit's. A size that shifts 67% of what it had
 * against an 18% neighbour reads as 1.6 whether the shop holds ten of it or
 * ten thousand.
 *
 * `soldOutCount` is the corroborating evidence: how many times a sale took a
 * variant of this size to zero. A high index with a high sell-out count is not
 * a statistical artefact, it is a size the shop keeps running out of. That
 * count is only possible because inventory_movements records stock_after — the
 * level a movement left behind — rather than only the delta.
 */

/** What the ledger and the catalogue know about one size, aggregated across
 *  every product that comes in it. */
export interface SizeFacts {
  size: string;
  /** Units sold in the window. */
  soldUnits: number;
  /** Units currently on the shelf across every variant of this size. */
  stockUnits: number;
  /** How many times a sale of this size took a variant to zero. */
  soldOutCount: number;
  /** How many distinct variants of this size exist. Context for the reader:
   *  an index built on one product is a fact about that product. */
  variantCount: number;
}

export type SizeVerdict = 'buy_more' | 'balanced' | 'buy_less' | 'unknown';

export interface SizeInsight extends SizeFacts {
  /** Of everything available in this size, the share that sold. 0-1. */
  sellThrough: number;
  /** This size's share of all units sold, 0-1. Reported for context, not used
   *  for the verdict — see the header. */
  demandShare: number;
  /** This size's share of all units on the shelf, 0-1. Context only. */
  stockShare: number;
  /** sellThrough over the unweighted mean sellThrough across sizes. Null when
   *  there is nothing to compare against. */
  demandIndex: number | null;
  verdict: SizeVerdict;
  /** The sentence to put in front of the buyer. */
  recommendation: string;
}

/**
 * How far from 1.0 an index has to be before it is worth acting on.
 *
 * A size at 1.08 is noise, and a report that tells a shopkeeper to change
 * their buying over 8% will be ignored within a month — which costs the
 * credibility of the rows that do matter. A quarter either way is a difference
 * you can see on the rail.
 */
const ACTIONABLE_MARGIN = 0.25;

/** Sizes with fewer sales than this in the window get no verdict. One customer
 *  buying two of something is not a demand signal. */
const MIN_SALES_FOR_VERDICT = 5;

/** A comparison needs something to compare against. With one size in the
 *  catalogue every ratio is 1.0 by construction, which would be a verdict
 *  invented out of nothing. */
const MIN_SIZES_TO_COMPARE = 2;

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function verdictFor(index: number | null, soldUnits: number): SizeVerdict {
  if (index === null || soldUnits < MIN_SALES_FOR_VERDICT) return 'unknown';
  if (index >= 1 + ACTIONABLE_MARGIN) return 'buy_more';
  if (index <= 1 - ACTIONABLE_MARGIN) return 'buy_less';
  return 'balanced';
}

function recommendationFor(insight: Omit<SizeInsight, 'recommendation'>, baseline: number): string {
  const { size, sellThrough, soldOutCount, verdict } = insight;
  const comparison = `It sells through at ${pct(sellThrough)} against ${pct(baseline)} across sizes.`;

  switch (verdict) {
    case 'buy_more': {
      const soldOut = soldOutCount > 0
        ? ` It sold out ${soldOutCount} time${soldOutCount === 1 ? '' : 's'}.`
        : '';
      return `Buy more ${size}. ${comparison}${soldOut}`;
    }
    case 'buy_less':
      return `Buy less ${size}. ${comparison} ${insight.stockUnits} left on the shelf.`;
    case 'balanced':
      return `${size} is stocked about right. ${comparison}`;
    default:
      return `Not enough sales of ${size} yet to say.`;
  }
}

/** sold / (sold + on the shelf). Negative stock — an oversold row — counts as
 *  none, so a rate can never exceed 1. */
function sellThroughOf(f: SizeFacts): number {
  const sold = Math.max(0, f.soldUnits);
  const available = sold + Math.max(0, f.stockUnits);
  return available > 0 ? sold / available : 0;
}

/**
 * The whole size run, ranked by how badly it is mis-bought.
 *
 * Sorted by distance from 1.0 rather than by index, so the size to buy far
 * less of ranks alongside the size to buy far more of — both are the same size
 * of mistake, and a report ordered by index alone buries one end of it. Sizes
 * with no verdict sink to the bottom whatever their ratio.
 */
export function sizeInsights(facts: SizeFacts[]): SizeInsight[] {
  const totalSold = facts.reduce((sum, f) => sum + Math.max(0, f.soldUnits), 0);
  const totalStock = facts.reduce((sum, f) => sum + Math.max(0, f.stockUnits), 0);

  // Only sizes that exist in some form. A size with neither sales nor stock is
  // not part of the run any more and must not drag the average down.
  const live = facts.filter((f) => Math.max(0, f.soldUnits) + Math.max(0, f.stockUnits) > 0);
  const baseline = live.length > 0
    ? live.reduce((sum, f) => sum + sellThroughOf(f), 0) / live.length
    : 0;

  const comparable = live.length >= MIN_SIZES_TO_COMPARE && baseline > 0;

  const insights = facts.map((f) => {
    const sellThrough = sellThroughOf(f);

    const base = {
      ...f,
      sellThrough,
      demandShare: totalSold > 0 ? Math.max(0, f.soldUnits) / totalSold : 0,
      stockShare: totalStock > 0 ? Math.max(0, f.stockUnits) / totalStock : 0,
      demandIndex: comparable ? sellThrough / baseline : null,
      verdict: 'unknown' as SizeVerdict,
    };

    base.verdict = verdictFor(base.demandIndex, f.soldUnits);

    return { ...base, recommendation: recommendationFor(base, baseline) };
  });

  return insights.sort((a, b) => {
    const distance = (i: SizeInsight) =>
      i.verdict === 'unknown' || i.demandIndex === null ? -1 : Math.abs(i.demandIndex - 1);

    // Rounded before comparing. With two live sizes the indices always sum to
    // exactly 2, so both are the same distance from 1.0 by construction and
    // the raw difference is float noise deciding the order of the report.
    const gap = Number(distance(b).toFixed(6)) - Number(distance(a).toFixed(6));
    if (gap !== 0) return gap;

    // Equally mis-bought: the under-stocked size first. Buying more of what is
    // selling recovers sales that are being lost this week; buying less of
    // what is not recovers money already spent, which will keep.
    return (b.demandIndex ?? -1) - (a.demandIndex ?? -1);
  });
}
