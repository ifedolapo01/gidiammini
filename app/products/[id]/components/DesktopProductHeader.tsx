/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Heart } from 'lucide-react';
import { Product } from '@/types/product';
import { Badge } from '@/components/ui';
import ProductShareMenu from './ProductShareMenu';

interface DesktopProductHeaderProps {
  product: Product;
  currentBasePrice: number;
  currentStock: number;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
}

export default function DesktopProductHeader({
  product,
  currentBasePrice,
  currentStock,
  isWishlisted,
  onToggleWishlist,
}: DesktopProductHeaderProps) {
  return (
    <div className="hidden md:flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Badge tone="neutral" variant="subtle" className="capitalize">
          {product.category.toLowerCase() === 'kids' ? 'Kids & Pre-teens' : product.category}
        </Badge>
        {currentStock <= 5 && currentStock > 0 && (
          <Badge tone="warning" variant="subtle">
            {currentStock <= 3 ? `Only ${currentStock} left!` : 'Low Stock'}
          </Badge>
        )}
        {currentStock === 0 && (
          <Badge tone="destructive" variant="subtle">
            Out of Stock
          </Badge>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <button
          className="p-2 hover:bg-surface-hover rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onToggleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          disabled={currentStock <= 0}
        >
          <Heart
            className={`w-5 h-5 ${isWishlisted ? 'fill-destructive text-destructive' : 'text-text-secondary'}`}
          />
        </button>
        <ProductShareMenu
          product={product}
          currentBasePrice={currentBasePrice}
          currentStock={currentStock}
          variant="desktop"
        />
      </div>
    </div>
  );
}
