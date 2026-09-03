/**
 * STOREFRONT layer — the size guide, opened from beside the size selector.
 *
 * Built on Core's Modal rather than a bespoke drawer: it already traps focus,
 * closes on Escape, returns focus to the button that opened it and locks body
 * scroll. A hand-rolled slide-over would be a second, worse implementation of
 * all four.
 *
 * The order of what is inside it is the point. Most specific first:
 *
 *   1. This product's fit — the only thing a parent actually wants to know,
 *      and the only part written about this garment.
 *   2. The category's guidance — the shop's own knowledge, from whoever
 *      handles the returns.
 *   3. The measurement table, with the bands this product is sold in marked.
 *   4. How to take the measurements, which is only useful once someone has
 *      decided to fetch a tape measure.
 *
 * A generic chart at the top would bury the two parts that are specific to
 * what they are looking at.
 */
'use client';

import { Ruler } from 'lucide-react';
import { Modal } from '@/components/ui';
import SizeChartTable from '@/components/commerce/SizeChartTable';
import { MEASURING_TIPS } from '@/lib/data/size-charts';
import { chartForProduct, matchedChartRows, type ProductSizing } from '@/lib/commerce/size-guide';
import FitNote from './FitNote';
import type { FitRating } from '@/lib/commerce/size-guide';

interface SizeGuideDrawerProps {
  open: boolean;
  onClose: () => void;
  product: ProductSizing;
  fitRating?: FitRating | null;
  fitNote?: string | null;
  /** categories.size_guidance for this product's category, when set. */
  categoryGuidance?: string | null;
}

export default function SizeGuideDrawer({
  open,
  onClose,
  product,
  fitRating,
  fitNote,
  categoryGuidance,
}: SizeGuideDrawerProps) {
  const chart = chartForProduct(product);
  const highlight = matchedChartRows(chart, product.sizes ?? []);

  return (
    <Modal open={open} onClose={onClose} title="Size guide" size="lg" scrollable>
      <div className="space-y-5">
        {(fitRating || fitNote) && (
          <FitNote rating={fitRating} note={fitNote} tone="panel" />
        )}

        {categoryGuidance && (
          <div className="rounded-control bg-background-secondary p-3">
            <p className="text-caption-md font-semibold uppercase tracking-wider text-text-secondary">
              About sizing in this range
            </p>
            <p className="mt-1 whitespace-pre-line text-body-sm text-text-secondary">
              {categoryGuidance}
            </p>
          </div>
        )}

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-body-md font-semibold text-text-primary">
            <Ruler className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            {chart.title}
          </h3>
          <SizeChartTable chart={chart} highlight={highlight} />
          <p className="mt-2 text-caption-md text-text-secondary">{chart.note}</p>
        </div>

        <div>
          <h3 className="mb-2 text-body-md font-semibold text-text-primary">How to measure</h3>
          <dl className="space-y-1.5">
            {MEASURING_TIPS.map((tip) => (
              <div key={tip.what} className="text-body-sm">
                <dt className="inline font-medium text-text-primary">{tip.what}: </dt>
                <dd className="inline text-text-secondary">{tip.how}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Said plainly, because the alternative is a parent trusting a table
            over a tape measure and then being disappointed by the parcel. */}
        <p className="border-t border-divider pt-3 text-caption-md text-text-muted">
          These measurements are a guide to standard sizing, not a promise about
          one garment. If your child is between two bands, size up — and if you
          are still unsure, ask us on the product page and we will measure the
          actual item.
        </p>
      </div>
    </Modal>
  );
}
