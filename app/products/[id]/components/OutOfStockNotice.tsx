/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
/**
 * What a shopper sees when the product they came for is sold out.
 *
 * This used to offer two dead ends. "Browse Available Products" sent them back
 * to the listing — away from the thing they had already chosen — and the
 * wishlist button wrote to a list nothing ever reads or acts on. Neither did
 * anything for the shopper or the store.
 *
 * The capture is now the point of the panel: the one thing this person wants is
 * to be told when they can buy it, and that is also the most valuable list the
 * store can build, because everyone on it has already picked a product.
 *
 * The wishlist stays as a secondary action, demoted. Browsing away does not
 * need a button — the whole site is still there.
 */
'use client';

import { PackageX } from 'lucide-react';
import { Button } from '@/components/ui';
import BackInStockForm from './BackInStockForm';

/** The mobile sticky bar scrolls here rather than offering its own dead end. */
export const OUT_OF_STOCK_PANEL_ID = 'out-of-stock-panel';

interface OutOfStockNoticeProps {
  productId: string;
  /** The variant on screen, when one is selected. */
  variantKey?: string | null;
  isWishlisted: boolean;
  onWishlist: () => void;
}

export default function OutOfStockNotice({
  productId,
  variantKey,
  isWishlisted,
  onWishlist,
}: OutOfStockNoticeProps) {
  return (
    <div
      id={OUT_OF_STOCK_PANEL_ID}
      className="mb-6 rounded-control border border-border bg-background-secondary p-4 md:mb-8"
    >
      {/* Neutral rather than destructive. Being sold out is not an error, and
          styling it as one made a temporary state look like something had gone
          wrong. */}
      <h4 className="mb-1 flex items-center font-bold text-text-primary">
        <PackageX className="mr-2 size-5 text-text-secondary" aria-hidden="true" />
        Sold out for now
      </h4>
      <p className="mb-4 text-body-sm text-text-secondary">
        This one has gone. We restock regularly — leave your email and you&apos;ll be first to know.
      </p>

      <BackInStockForm productId={productId} variantKey={variantKey} />

      <div className="mt-4 border-t border-divider pt-3">
        <Button variant="ghost" size="sm" onClick={onWishlist} className="w-full sm:w-auto">
          {isWishlisted ? '✓ Saved to wishlist' : 'Save to wishlist'}
        </Button>
      </div>
    </div>
  );
}
