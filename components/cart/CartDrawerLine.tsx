/** STOREFRONT layer — one cart line inside the drawer. Presentation only. */
'use client';

import ProductImage from '@/components/commerce/ProductImage';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { CartItem } from '@/types/order';

interface CartDrawerLineProps {
  item: CartItem;
  /** True for the line that was just added — the confirmation the shopper came
   * here for, which the old button feedback never reached on a phone. */
  justAdded: boolean;
}

export default function CartDrawerLine({ item, justAdded }: CartDrawerLineProps) {
  const variant = [item.color, item.size].filter(Boolean).join(' · ');

  return (
    <li className="flex gap-3 py-3">
      <ProductImage
        src={item.image}
        alt={item.name}
        className="w-16 aspect-square rounded-surface flex-shrink-0"
        sizes="64px"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-body-sm font-semibold text-text-primary line-clamp-2">{item.name}</p>
          <p className="text-body-sm font-semibold text-text-primary whitespace-nowrap">
            {formatCurrency(item.price * item.quantity)}
          </p>
        </div>

        {variant && <p className="mt-0.5 text-caption-md text-text-secondary truncate">{variant}</p>}

        <p className="mt-0.5 text-caption-md text-text-secondary">
          Qty {item.quantity} × {formatCurrency(item.price)}
        </p>

        {/* Text, not a colour: the whole point is that it is readable. */}
        {justAdded && (
          <p className="mt-1 text-caption-md font-semibold text-success">Just added</p>
        )}
      </div>
    </li>
  );
}
