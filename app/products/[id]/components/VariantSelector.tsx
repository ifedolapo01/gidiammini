/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// Choosing a size and a colour — and, now, understanding what the sizes mean.
//
// The size guide lives here rather than further down the page because this is
// where the doubt happens: the moment somebody is looking at "6-12 months" and
// wondering whether their eight-month-old is in it. A guide in the accordion
// below, or on a separate page, is a guide nobody opens.
//
// Two things are surfaced without a click, because a shopper who never opens
// the drawer should still get them: the label ("Age" rather than "Size", from
// sizing_type, which the model has always carried and nothing ever read), and
// whether the garment runs small.
'use client';

import { useState } from 'react';
import { Ruler } from 'lucide-react';
import { isFitRating, sizeSelectorLabel } from '@/lib/commerce/size-guide';
import type { Product } from '@/types/product';
import FitNote from './FitNote';
import SizeGuideDrawer from './SizeGuideDrawer';

interface VariantSelectorProps {
  /**
   * The product itself rather than six parallel props about it. Sizes, sizing
   * type, category and the fit note are all fields of one row, and the guide
   * needs all four to decide which chart to draw.
   */
  product: Pick<Product, 'sizes' | 'sizing_type' | 'category' | 'fit_rating' | 'fit_note'>;
  colors: string[];
  selectedSize: string;
  selectedColor: string;
  onSelectSize: (size: string) => void;
  onSelectColor: (color: string) => void;
  currentStock: number;
  /** categories.size_guidance, loaded with the product. */
  categoryGuidance?: string | null;
}

function titleCase(value: string): string {
  return value.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VariantSelector({
  product,
  colors,
  selectedSize,
  selectedColor,
  onSelectSize,
  onSelectColor,
  currentStock,
  categoryGuidance,
}: VariantSelectorProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  const sizes = product.sizes ?? [];
  const sizeLabel = sizeSelectorLabel(product.sizing_type);
  const fitRating = isFitRating(product.fit_rating) ? product.fit_rating : null;
  const fitNote = product.fit_note ?? null;

  return (
    <>
      {/* Size Selector */}
      {sizes.length > 0 && (
        <div className="mb-6 md:mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold text-body-md md:text-body-lg text-text-primary">Select {sizeLabel}</h3>

            <div className="flex items-center gap-3">
              {currentStock <= 0 && (
                <span className="text-body-sm text-destructive font-medium">
                  Out of Stock - Cannot select {sizeLabel.toLowerCase()}
                </span>
              )}
              {/* Available whatever the stock state: somebody deciding whether
                  to wait for a restock still needs to know what fits. */}
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-control px-1 py-1 text-body-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                <Ruler className="h-4 w-4" aria-hidden="true" />
                Size guide
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {sizes.map(size => (
              <button
                key={size}
                onClick={() => currentStock > 0 && onSelectSize(size)}
                className={`px-4 py-3 md:px-4 md:py-2 border rounded-control transition-all text-body-sm md:text-body-md ${
                  selectedSize === size && currentStock > 0
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:border-border-strong text-text-primary'
                } ${currentStock <= 0 ? 'opacity-50 cursor-not-allowed bg-background-tertiary' : ''}`}
                aria-pressed={selectedSize === size}
                disabled={currentStock <= 0}
              >
                {titleCase(size)}
              </button>
            ))}
          </div>

          {/* Under the buttons, not behind the drawer. This is the one fact
              that changes which button they press. */}
          <FitNote rating={fitRating} note={fitNote} tone="inline" />

          <SizeGuideDrawer
            open={guideOpen}
            onClose={() => setGuideOpen(false)}
            product={{
              sizes,
              sizing_type: product.sizing_type,
              category: product.category,
            }}
            fitRating={fitRating}
            fitNote={fitNote}
            categoryGuidance={categoryGuidance}
          />
        </div>
      )}

      {/* Color Selector */}
      {colors.length > 0 && (
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-body-md md:text-body-lg text-text-primary">Select Color</h3>
            {currentStock <= 0 && (
              <span className="text-body-sm text-destructive font-medium">
                Out of Stock - Cannot select color
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map(color => (
              <button
                key={color}
                onClick={() => currentStock > 0 && onSelectColor(color)}
                className={`px-4 py-3 md:px-4 md:py-2 border rounded-control flex items-center transition-all text-text-primary ${
                  selectedColor === color && currentStock > 0
                    ? 'border-primary bg-primary/10 text-text-primary'
                    : 'hover:border-border-strong'
                } ${currentStock <= 0 ? 'opacity-50 cursor-not-allowed bg-background-tertiary' : ''}`}
                aria-pressed={selectedColor === color}
                disabled={currentStock <= 0}
              >
                <span className="text-body-sm md:text-body-md">{titleCase(color)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
