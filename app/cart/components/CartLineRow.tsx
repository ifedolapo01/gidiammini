/** STOREFRONT layer — one line in the cart. Presentation only. */
'use client';

import { Trash2 } from 'lucide-react';
import { QuantitySelector } from '@/components/commerce/QuantitySelector';
import ProductImage from '@/components/commerce/ProductImage';
import { formatCurrency } from '@/lib/commerce/pricing';
import { describeStockShortage, type CartStockIssue } from '@/lib/commerce/cart-stock';
import type { CartItem } from '@/types/order';
import { announce } from '@/lib/announce';

interface CartLineRowProps {
  item: CartItem;
  /** Present when the live stock check found this line unbuyable. */
  issue?: CartStockIssue;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export default function CartLineRow({ item, issue, onQuantityChange, onRemove }: CartLineRowProps) {
  return (
    <div className="flex items-center border-b border-border p-3 sm:p-4 md:p-6 last:border-b-0 text-text-primary">
      {/* Square rather than the old `h-auto`: the row's height no
          longer depends on a photo that has not arrived. */}
      <ProductImage
        src={item.image}
        alt={item.name}
        className="w-16 sm:w-20 md:w-24 aspect-square rounded-surface flex-shrink-0"
        sizes="96px"
      />

      <div className="flex-1 ml-3 sm:ml-4 md:ml-6 min-w-0"> {/* Added min-w-0 */}
        <h3 className="font-semibold text-body-sm sm:text-body-md md:text-body-lg truncate">{item.name}</h3>
        <p className="text-text-secondary text-caption-md sm:text-body-sm mt-1 truncate">
          {item.color && `Color: ${item.color}`}
          {item.size && ` • Size/Age: ${item.size}`}
        </p>

        {/* Announced politely: it appears when the stock read comes back, not
            in response to anything the shopper just did. */}
        {issue && (
          <p role="status" className="mt-1 text-caption-md sm:text-body-sm text-destructive">
            {describeStockShortage(issue)}
          </p>
        )}

        <div className="flex items-center justify-between mt-2 sm:mt-3 md:mt-4 flex-wrap sm:flex-nowrap gap-2">
          <div className="order-1 sm:order-none">
            <QuantitySelector
              size="sm"
              quantity={item.quantity}
              onChange={onQuantityChange}
              announceLabel={item.name}
            />
          </div>

          <div className="flex items-center order-2 sm:order-none ml-auto sm:ml-0">
            <span className="text-body-sm sm:text-body-md md:text-body-lg font-semibold whitespace-nowrap">
              {formatCurrency(item.price * item.quantity)}
            </span>
            {/* The row disappears on click, taking the focused button with
                it, so without this the press produces no sound at all. */}
            <button
              type="button"
              onClick={() => {
                onRemove();
                announce(`${item.name} removed from your cart`);
              }}
              className="text-destructive/70 hover:text-destructive ml-3 sm:ml-4 md:ml-6"
              aria-label={`Remove ${item.name}`}
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
