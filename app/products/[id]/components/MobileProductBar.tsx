/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { ChevronLeft, Heart } from 'lucide-react';
import { Product } from '@/types/product';
import ProductShareMenu from './ProductShareMenu';

interface MobileProductBarProps {
  product: Product;
  currentBasePrice: number;
  currentStock: number;
  isWishlisted: boolean;
  onBack: () => void;
  onToggleWishlist: () => void;
}

export default function MobileProductBar({
  product,
  currentBasePrice,
  currentStock,
  isWishlisted,
  onBack,
  onToggleWishlist,
}: MobileProductBarProps) {
  return (
    <div className="sticky top-0 z-40 bg-surface border-b border-border md:hidden">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center text-text-primary">
          <ChevronLeft className="w-5 h-5 mr-1" />
          <span className="text-body-sm">Back</span>
        </button>

        <div className="flex items-center space-x-3">
          <button
            className="p-2 hover:bg-surface-hover rounded-full"
            onClick={onToggleWishlist}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            disabled={currentStock <= 0}
          >
            <Heart
              className={`w-5 h-5 ${isWishlisted ? 'fill-destructive text-destructive' : 'text-text-secondary'} ${currentStock <= 0 ? 'opacity-50' : ''}`}
            />
          </button>
          <ProductShareMenu
            product={product}
            currentBasePrice={currentBasePrice}
            currentStock={currentStock}
            variant="mobile"
          />
        </div>
      </div>
    </div>
  );
}
