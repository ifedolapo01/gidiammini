// components/WishlistProvider.tsx
//
// IDS ONLY.
//
// This used to store whole product objects in localStorage — name, image,
// price, stock — captured at the moment the heart was tapped. Everything about
// that snapshot except the id goes stale: a saved item would show what it cost
// weeks ago, whether it was in stock weeks ago, and a rating from before
// anybody had left one. The wishlist page papered over it by re-fetching, but
// the header, the product page and anything else reading this list did not.
//
// So the browser stores a list of ids and nothing else, and every surface that
// needs a card asks the catalogue for one. Ids do not go stale, and the same
// list is what the account already stores (see 20251101003700), so the local
// and server copies are finally the same kind of thing.
'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { readStoredWishlist, WISHLIST_STORAGE_KEY } from '@/lib/commerce/wishlist-storage';
import { useWishlistSync } from './hooks/useWishlistSync';
import { announce } from '@/lib/announce';

interface WishlistContextType {
  /** Product ids, in the order they were saved. */
  ids: string[];
  isInWishlist: (productId: string) => boolean;
  addToWishlist: (productId: string) => void;
  removeFromWishlist: (productId: string) => void;
  toggleWishlist: (productId: string) => void;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Reads both shapes: the old array of product objects is converted to ids
    // on the way in, so nobody's saved list disappears on the deploy that
    // changed the format.
    setIds(readStoredWishlist(localStorage.getItem(WISHLIST_STORAGE_KEY)));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
    }
  }, [ids, isLoaded]);

  // Signed in, the list also lives on the account and follows the customer to
  // their other devices. Signed out — the normal case — none of this fires and
  // the wishlist behaves exactly as it always has.
  const onMerged = useCallback((merged: string[]) => setIds(merged), []);
  const { mirror } = useWishlistSync({ localIds: ids, ready: isLoaded, onMerged });

  const isInWishlist = (productId: string) => ids.includes(productId);

  const addToWishlist = (productId: string) => {
    setIds((current) => (current.includes(productId) ? current : [...current, productId]));
    mirror('PUT', productId);
  };

  const removeFromWishlist = (productId: string) => {
    setIds((current) => current.filter((id) => id !== productId));
    // Explicit, because the merge is a union: a removal that only happened
    // locally would come back on the next sync.
    mirror('DELETE', productId);
  };

  /**
   * Announced here rather than at each heart button, so every caller gets it
   * and none of them can forget. The button's own accessible name describes
   * what pressing it will do next; nothing described what it just did.
   */
  const toggleWishlist = (productId: string) => {
    const has = ids.includes(productId);
    setIds((current) => (has ? current.filter((id) => id !== productId) : [...current, productId]));
    mirror(has ? 'DELETE' : 'PUT', productId);
    announce(has ? 'Removed from your wishlist' : 'Saved to your wishlist');
  };

  const clearWishlist = () => {
    setIds([]);
  };

  return (
    <WishlistContext.Provider
      value={{ ids, isInWishlist, addToWishlist, removeFromWishlist, toggleWishlist, clearWishlist }}
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
