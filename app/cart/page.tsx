/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { useCart } from '@/components/CartProvider';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { QuantitySelector } from '@/components/commerce/QuantitySelector';
import { formatCurrency } from '@/lib/commerce/pricing';
import CartRecommendations from './components/CartRecommendations';
import ProductImage from '@/components/commerce/ProductImage';

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, getTotal } = useCart();

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
            {items.map((item) => (
              <div key={item.productId} className="flex items-center border-b border-border p-3 sm:p-4 md:p-6 last:border-b-0 text-text-primary">
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
                  <div className="flex items-center justify-between mt-2 sm:mt-3 md:mt-4 flex-wrap sm:flex-nowrap gap-2">
                    <div className="order-1 sm:order-none">
                      <QuantitySelector
                        size="sm"
                        quantity={item.quantity}
                        onChange={(next) => updateQuantity(item.productId, item.size, item.color, next)}
                      />
                    </div>

                    <div className="flex items-center order-2 sm:order-none ml-auto sm:ml-0">
                      <span className="text-body-sm sm:text-body-md md:text-body-lg font-semibold whitespace-nowrap">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.productId, item.size, item.color)}
                        className="text-destructive/70 hover:text-destructive ml-3 sm:ml-4 md:ml-6"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div>
          <div className="bg-surface rounded-surface shadow-elevation-1 border border-border p-4 sm:p-6 sticky top-20 sm:top-24 text-text-primary">
            <h2 className="text-body-lg sm:text-h5 font-bold mb-4 sm:mb-6">Order Summary</h2>

            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <div className="flex justify-between text-body-sm sm:text-body-md">
                <span>Subtotal ({items.length} items)</span>
                <span>{formatCurrency(getTotal())}</span>
              </div>
              <div className="flex justify-between text-body-sm sm:text-body-md">
                <span>Shipping</span>
                <span className="text-text-secondary">Calculated at checkout</span>
              </div>
              <div className="flex justify-between text-body-sm sm:text-body-md">
                <span>Tax (7.5%)</span>
                <span>{formatCurrency(getTotal() * 0.075)}</span>
              </div>
            </div>

            <div className="border-t border-border pt-3 sm:pt-4 mb-4 sm:mb-6">
              <div className="flex justify-between text-body-md sm:text-body-lg font-bold">
                <span>Estimated Total</span>
                <span className='text-primary'>
                  {formatCurrency(getTotal() + (getTotal() * 0.075))}
                </span>
              </div>
              <p className="text-caption-md sm:text-body-sm text-text-secondary mt-1 sm:mt-2">
                Shipping fee will be added based on location
              </p>
            </div>

            <Link
              href="/checkout"
              className="block w-full bg-primary text-primary-foreground text-center py-2 sm:py-3 rounded-control font-semibold text-body-sm sm:text-body-md hover:bg-primary-hover mb-3 sm:mb-4"
            >
              Proceed to Checkout
            </Link>

            <Link
              href="/products"
              className="block w-full border border-border text-center py-2 sm:py-3 rounded-control font-semibold text-body-sm sm:text-body-md hover:bg-surface-hover"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>

      {/* Below the summary, not beside it. The cross-sell must not compete with
          the checkout button for the same glance — it is there for the shopper
          who has already scrolled past it and is still deciding. */}
      <CartRecommendations productIds={items.map((item) => item.productId)} />
    </div>
  );
}