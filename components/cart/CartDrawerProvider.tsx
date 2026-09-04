/**
 * STOREFRONT layer — who may open the cart drawer, and what it was opened for.
 *
 * The drawer is mounted once at the root and opened from wherever an item is
 * added, so adding to the cart confirms itself in place instead of navigating
 * away — or, as it did before, by rewriting a button's textContent.
 */
'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import CartDrawer from './CartDrawer';

interface CartDrawerContextValue {
  isOpen: boolean;
  /**
   * Opens the drawer. `highlightKey` is the cartLineKey of the line just
   * added, which the drawer marks — the confirmation the mobile button never
   * gave. Omit it to show the cart without singling out a line.
   */
  openCart: (highlightKey?: string) => void;
  closeCart: () => void;
}

const CartDrawerContext = createContext<CartDrawerContextValue | undefined>(undefined);

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | undefined>(undefined);

  const openCart = useCallback((key?: string) => {
    setHighlightKey(key);
    setIsOpen(true);
  }, []);

  // The highlight is kept through the close so the panel does not visibly
  // change as it goes; the next open sets it again.
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, openCart, closeCart }),
    [isOpen, openCart, closeCart]
  );

  return (
    <CartDrawerContext.Provider value={value}>
      {children}
      <CartDrawer open={isOpen} onClose={closeCart} highlightKey={highlightKey} />
    </CartDrawerContext.Provider>
  );
}

/** Throws without a provider, like useCart: both are mounted by the root
 *  layout, so a missing one is a wiring mistake, not a runtime condition. */
export function useCartDrawer(): CartDrawerContextValue {
  const context = useContext(CartDrawerContext);
  if (!context) {
    throw new Error('useCartDrawer must be used within CartDrawerProvider');
  }
  return context;
}
