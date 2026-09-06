/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Check, AlertTriangle, Package } from 'lucide-react';
import { getStockStatus } from '@/lib/commerce/stock';
import { useStoreSettings } from '@/components/StoreSettingsProvider';

interface StockStatusPanelProps {
  stock: number;
}

/**
 * Storefront-specific wrapper around Commerce's getStockStatus — kept as its own
 * component rather than the shared StockBadge because this surface renders a full
 * icon + label + description paragraph layout (not a pill), which StockBadge
 * doesn't support. Reuses getStockStatus for the in/low/out classification only.
 */
export default function StockStatusPanel({ stock }: StockStatusPanelProps) {
  return (
    <div className="mb-4 p-3 bg-background-secondary rounded-control border border-border">
      <StockStatus stock={stock} />
    </div>
  );
}

function StockStatus({ stock }: { stock: number }) {
  // The shop's own threshold, not a literal 5. A shop that restocks weekly and
  // one that restocks quarterly do not agree about what "only a few left"
  // means, and this is the sentence a shopper acts on.
  const { lowStockThreshold } = useStoreSettings();

  // Defensive edge case preserved from the original inline component: negative
  // stock shouldn't happen, but is handled distinctly from "out of stock" (0).
  if (stock < 0) {
    return (
      <div className="flex items-center text-destructive">
        <Package className="w-5 h-5 mr-2" />
        <span className="font-medium">Inventory Error</span>
      </div>
    );
  }

  const status = getStockStatus(stock, lowStockThreshold);

  if (status.level === 'in') {
    return (
      <div className="flex items-center">
        <Check className="w-5 h-5 text-success mr-2" />
        <div>
          <span className="text-success font-medium">In Stock</span>
          <span className="text-text-secondary text-body-sm ml-2">
            ({stock} available)
          </span>
          <p className="text-caption-md text-success mt-1">
            • Ready to ship within 24 hours
          </p>
        </div>
      </div>
    );
  }

  if (status.level === 'low') {
    return (
      <div className="flex items-center">
        <AlertTriangle className="w-5 h-5 text-warning mr-2" />
        <div>
          <span className="text-warning font-medium">Low Stock</span>
          <span className="text-text-secondary text-body-sm ml-2">
            (Only {stock} left)
          </span>
          <p className="text-caption-md text-warning mt-1">
            • Selling fast! Order now to secure your item
          </p>
        </div>
      </div>
    );
  }

  // status.level === 'out'
  return (
    <div className="flex items-center">
      <Package className="w-5 h-5 text-destructive mr-2" />
      <div>
        <span className="text-destructive font-medium">Out of Stock</span>
        <span className="text-text-secondary text-body-sm ml-2">
          (Currently unavailable)
        </span>
        <p className="text-caption-md text-destructive mt-1">
          • Check back soon for restock updates
          <br />
          • Contact us for estimated restock date
        </p>
      </div>
    </div>
  );
}
