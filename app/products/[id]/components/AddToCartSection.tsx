/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { QuantitySelector } from '@/components/commerce/QuantitySelector';
import { formatCurrency } from '@/lib/commerce/pricing';

interface AddToCartSectionProps {
  currentStock: number;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  selectedSize: string | undefined;
  selectedColor: string | undefined;
  finalPrice: number;
  onAddToCart: () => void;
}

export default function AddToCartSection({
  currentStock,
  quantity,
  onQuantityChange,
  selectedSize,
  selectedColor,
  finalPrice,
  onAddToCart,
}: AddToCartSectionProps) {
  const canAdd = Boolean(selectedSize && selectedColor);

  if (currentStock <= 0) {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border shadow-elevation-3 z-50 p-4">
        <div className="text-center">
          <p className="text-destructive font-medium mb-2">This item is currently out of stock</p>
          <button
            onClick={() => window.location.href = '/products'}
            className="w-full bg-surface-inverse text-on-inverse py-4 rounded-control font-semibold hover:opacity-90 transition-all text-body-lg"
          >
            Browse Other Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Quantity & Add to Cart - Desktop */}
      <div className="md:mb-8">
        <div className="hidden md:flex items-center gap-4 mb-6">
          <QuantitySelector quantity={quantity} onChange={onQuantityChange} min={1} max={currentStock} />
          <button
            id="add-to-cart-button"
            onClick={onAddToCart}
            disabled={!canAdd}
            className="flex-1 bg-primary text-primary-foreground py-3 rounded-control font-semibold hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-all text-body-md md:text-body-lg"
          >
            {!canAdd ? 'Select Options' : 'Add to Cart'}
          </button>
        </div>
      </div>

      {/* Mobile Bottom Sticky Add to Cart */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border shadow-elevation-3 z-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-body-sm text-text-secondary">Total</p>
            <p className="font-bold text-h5 text-primary">{formatCurrency(finalPrice * quantity)}</p>
          </div>
          <QuantitySelector
            quantity={quantity}
            onChange={onQuantityChange}
            min={1}
            max={currentStock}
            className="border-border-strong"
          />
        </div>
        <button
          id="add-to-cart-button"
          onClick={onAddToCart}
          disabled={!canAdd}
          className="w-full bg-primary text-primary-foreground py-4 rounded-control font-semibold hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-all text-body-lg"
        >
          {!canAdd ? 'Select Options' : 'Add to Cart'}
        </button>
      </div>
    </>
  );
}
