// components/CartProvider.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem } from '@/types/order';

/** A server-priced line, as returned by /api/checkout/quote. Only the fields
 * needed to match it back to a cart line and correct its price. */
export interface PricedCartLine {
  product_id: string;
  size: string | null;
  color: string | null;
  price: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, size?: string, color?: string) => void;
  updateQuantity: (productId: string, size: string | undefined, color: string | undefined, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  /** Adopts server-authoritative prices, so what the cart displays matches
   * what the server will actually charge. Returns true if anything changed. */
  syncPrices: (lines: PricedCartLine[]) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedCart = localStorage.getItem('gidiammini_cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse saved cart from localStorage:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('gidiammini_cart', JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const addToCart = (item: CartItem) => {
    setItems(current => {
      const existing = current.find(i => 
        i.productId === item.productId && 
        i.size === item.size && 
        i.color === item.color
      );
      if (existing) {
        return current.map(i => 
          (i.productId === item.productId && i.size === item.size && i.color === item.color)
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...current, item];
    });
  };

  const removeFromCart = (productId: string, size?: string, color?: string) => {
    setItems(current => current.filter(item => 
      !(item.productId === productId && item.size === size && item.color === color)
    ));
  };

  const updateQuantity = (productId: string, size: string | undefined, color: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, size, color);
      return;
    }
    setItems(current => 
      current.map(item => 
        (item.productId === productId && item.size === size && item.color === color) 
          ? { ...item, quantity } 
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  /** The cart's prices are only ever a display copy of what the catalogue said
   * when an item was added; the server prices the order at checkout. When the
   * two disagree (a discount expired, an admin changed a price), the server
   * wins and the cart is corrected so the customer sees the real amount. */
  const syncPrices = (lines: PricedCartLine[]) => {
    const priceFor = new Map(
      lines.map((line) => [`${line.product_id}|${line.size ?? ''}|${line.color ?? ''}`, line.price])
    );

    const keyOf = (item: CartItem) => `${item.productId}|${item.size ?? ''}|${item.color ?? ''}`;
    const corrected = (item: CartItem) => priceFor.get(keyOf(item)) ?? item.price;

    // Computed against the rendered items rather than inside the updater, so
    // the caller gets a reliable answer it can act on in the same tick.
    const changed = items.some(item => corrected(item) !== item.price);

    if (changed) {
      setItems(current => current.map(item => ({ ...item, price: corrected(item) })));
    }

    return changed;
  };

  const getTotal = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getItemCount = () => {
    return items.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotal,
      getItemCount,
      syncPrices
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}