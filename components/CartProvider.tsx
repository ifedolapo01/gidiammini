// components/CartProvider.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem } from '@/types/product';

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
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
      const existing = current.find(i => i.productId === item.productId);
      if (existing) {
        return current.map(i => 
          i.productId === item.productId 
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...current, item];
    });
  };

  const removeFromCart = (productId: string) => {
    setItems(current => current.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(current => 
      current.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
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
      getItemCount
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