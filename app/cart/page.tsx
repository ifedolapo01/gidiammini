/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { cartLineKey } from '@/lib/commerce/cart-input';
import CartRecommendations from './components/CartRecommendations';
import CartLineRow from './components/CartLineRow';
import CartSummary from './components/CartSummary';
import { useCartStockIssues } from './hooks/useCartStockIssues';

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, getTotal, getItemCount } = useCart();
  // Live stock, read on mount: a line that has sold out since it was added is
  // flagged here rather than at the checkout gate.
  const issues = useCartStockIssues(items);

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center overflow-x-hidden">
        <div className="max-w-md mx-auto">
          <h1 className="text-h5 sm:text-h4 font-bold mb-4">Your cart is empty</h1>
          <p className="text-text-secondary text-body-sm sm:text-body-md mb-8">
            Add some products to your cart to see them here.
          </p>
          <Link
            href="/products"
            className="inline-block bg-primary text-primary-foreground px-4 sm:px-6 py-2 sm:py-3 rounded-control font-semibold text-body-sm sm:text-body-md hover:bg-primary-hover"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 overflow-x-hidden">
      <h1 className="text-h5 sm:text-h4 md:text-h3 font-bold mb-4 sm:mb-6 md:mb-8">Shopping Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
        <div className="lg:col-span-2">
          <div className="bg-surface rounded-surface shadow-elevation-1 border border-border">
            {items.map((item) => {
              // Product + size + colour, because that is what the cart itself
              // keys on. On the product id alone, two variants of one product
              // collide and React reconciles the wrong row.
              const key = cartLineKey(item.productId, item.size, item.color);

              return (
                <CartLineRow
                  key={key}
                  item={item}
                  issue={issues.get(key)}
                  onQuantityChange={(next) => updateQuantity(item.productId, item.size, item.color, next)}
                  onRemove={() => removeFromCart(item.productId, item.size, item.color)}
                />
              );
            })}
          </div>
        </div>

        <div>
          <CartSummary
            subtotal={getTotal()}
            itemCount={getItemCount()}
            issueCount={issues.size}
          />
        </div>
      </div>

      {/* Below the summary, not beside it. The cross-sell must not compete with
          the checkout button for the same glance — it is there for the shopper
          who has already scrolled past it and is still deciding. */}
      <CartRecommendations productIds={items.map((item) => item.productId)} />
    </div>
  );
}
