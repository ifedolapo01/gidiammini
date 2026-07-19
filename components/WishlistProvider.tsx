// components/WishlistProvider.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ProductCardProduct } from '@/types/product';

interface WishlistContextType {
  items: ProductCardProduct[];
  isInWishlist: (productId: string) => boolean;
  addToWishlist: (product: ProductCardProduct) => void;
  removeFromWishlist: (productId: string) => void;
  toggleWishlist: (product: ProductCardProduct) => void;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ProductCardProduct[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedWishlist = localStorage.getItem('gidiammini_wishlist');
    if (savedWishlist) {
      try {
        setItems(JSON.parse(savedWishlist));
      } catch (e) {
        console.error('Failed to parse saved wishlist from localStorage:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('gidiammini_wishlist', JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const isInWishlist = (productId: string) => items.some(item => item.id === productId);

  const addToWishlist = (product: ProductCardProduct) => {
    setItems(current => (current.some(item => item.id === product.id) ? current : [...current, product]));
  };

  const removeFromWishlist = (productId: string) => {
    setItems(current => current.filter(item => item.id !== productId));
  };

  const toggleWishlist = (product: ProductCardProduct) => {
    setItems(current =>
      current.some(item => item.id === product.id)
        ? current.filter(item => item.id !== product.id)
        : [...current, product]
    );
  };

  const clearWishlist = () => {
    setItems([]);
  };

  return (
    <WishlistContext.Provider
      value={{ items, isInWishlist, addToWishlist, removeFromWishlist, toggleWishlist, clearWishlist }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
}
