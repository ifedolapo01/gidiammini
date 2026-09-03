/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { QuantitySelector } from '@/components/commerce/QuantitySelector';
import { formatCurrency } from '@/lib/commerce/pricing';
import { OUT_OF_STOCK_PANEL_ID } from './OutOfStockNotice';

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
      // The sticky bar sits directly over the out-of-stock panel on a phone, so
      // it must not compete with it. It used to send the shopper back to the
      // listing — away from the product they had already chosen — while the
      // "tell me when it's back" form was hidden underneath it. Now it points
      // at that form instead.
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border shadow-elevation-3 z-50 p-4">
        <div className="text-center">
          <p className="text-text-secondary font-medium mb-2">Sold out for now</p>
          <button
            onClick={() => {
              const panel = document.getElementById(OUT_OF_STOCK_PANEL_ID);
              panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Focus follows the scroll, so a keyboard or screen-reader user
              // lands in the form rather than being left where they were.
              panel?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
            }}
            className="w-full bg-surface-inverse text-on-inverse py-4 rounded-control font-semibold hover:opacity-90 transition-all text-body-lg"
          >
            Email me when it's back
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
