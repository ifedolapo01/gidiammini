/**
 * STOREFRONT layer — the cart, as a slide-over.
 *
 * Replaces the add-to-cart confirmation that used to be
 * `getElementById('add-to-cart-button').textContent = 'Added to Cart!'`. There
 * are two such buttons — a desktop one and a sticky mobile one — so that
 * always updated the desktop one, and a phone got no confirmation at all on
 * the primary action of the primary page.
 *
 * It does four jobs at once: it confirms the add, it names the line that was
 * added, it carries the running total and a way to check out without leaving
 * the product page, and it holds the cross-sell that a page navigation used to
 * be required to reach.
 *
 * Built on Core's Modal in its slide-over placement, which brings the focus
 * trap, Escape, focus restoration and body-scroll lock with it.
 */
'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Modal } from '@/components/ui';
import { useCart } from '@/components/CartProvider';
import { cartLineKey } from '@/lib/commerce/cart-input';
import { formatCurrency } from '@/lib/commerce/pricing';
import CartDrawerLine from './CartDrawerLine';
import CartDrawerCrossSell from './CartDrawerCrossSell';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  /** cartLineKey of the line just added, if the drawer was opened by an add. */
  highlightKey?: string;
}

export default function CartDrawer({ open, onClose, highlightKey }: CartDrawerProps) {
  const { items, getTotal, getItemCount } = useCart();
  const itemCount = getItemCount();

  // The dialog's accessible name is announced when it opens, so this line is
  // what tells a screen-reader user the add succeeded.
  const title = highlightKey ? 'Added to your cart' : 'Your cart';

  return (
    <Modal open={open} onClose={onClose} placement="right" title={title} padded={false}>
      <div className="flex h-full flex-col">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <ShoppingBag className="h-8 w-8 text-text-muted" aria-hidden="true" />
            <p className="text-body-md font-semibold text-text-primary">Your cart is empty</p>
            <Link
              href="/products"
              onClick={onClose}
              className="text-body-sm font-semibold text-primary hover:underline"
            >
              Browse the collection
            </Link>
          </div>
        ) : (
          <>
            {/* The one scrolling region: the lines and the suggestion under
                them. The totals and the buttons stay put, so "checkout" is
                never something you have to scroll to find. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6">
              <ul className="divide-y divide-divider">
                {items.map((item) => {
                  const key = cartLineKey(item.productId, item.size, item.color);
                  return (
                    <CartDrawerLine key={key} item={item} justAdded={key === highlightKey} />
                  );
                })}
              </ul>

              <div className="pb-4 pt-2">
                <CartDrawerCrossSell productIds={items.map((item) => item.productId)} />
              </div>
            </div>

            <div className="shrink-0 border-t border-border bg-surface p-6 pt-4">
              <div className="flex items-center justify-between text-body-md font-semibold text-text-primary">
                <span>
                  Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                </span>
                <span>{formatCurrency(getTotal())}</span>
              </div>
              <p className="mt-1 text-caption-md text-text-secondary">
                Shipping and tax calculated at checkout.
              </p>

              <Link
                href="/checkout"
                onClick={onClose}
                className="mt-4 block w-full rounded-control bg-primary py-3 text-center text-body-md font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Checkout
              </Link>

              <div className="mt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-control py-2 text-body-sm font-semibold text-text-primary hover:underline"
                >
                  Keep shopping
                </button>
                {/* Still offered: quantities and removals live on the cart
                    page, and this drawer deliberately does not duplicate it. */}
                <Link
                  href="/cart"
                  onClick={onClose}
                  className="rounded-control py-2 text-body-sm text-text-secondary hover:text-text-primary hover:underline"
                >
                  View full cart
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
