/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

interface OutOfStockNoticeProps {
  isWishlisted: boolean;
  onWishlist: () => void;
}

export default function OutOfStockNotice({ isWishlisted, onWishlist }: OutOfStockNoticeProps) {
  return (
    <div className="mb-6 md:mb-8 p-4 bg-destructive-background border border-destructive-border rounded-control">
      <h4 className="font-bold text-destructive mb-2 flex items-center">
        <AlertTriangle className="w-5 h-5 mr-2" />
        Currently Unavailable
      </h4>
      <p className="text-destructive text-body-sm">
        This product is out of stock. We're working to restock it as soon as possible.
      </p>
      <div className="mt-3 space-y-2">
        <button
          onClick={() => window.location.href = '/products'}
          className="w-full bg-surface-inverse text-on-inverse py-3 rounded-control font-medium hover:opacity-90"
        >
          Browse Available Products
        </button>
        <Button
          variant="outline"
          size="lg"
          onClick={onWishlist}
          className="w-full font-medium"
        >
          {isWishlisted ? '✓ Added to Wishlist' : 'Add to Wishlist'}
        </Button>
      </div>
    </div>
  );
}
