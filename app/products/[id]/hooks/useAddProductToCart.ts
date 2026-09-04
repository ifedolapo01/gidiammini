/**
 * STOREFRONT layer — validating and performing "add to cart" on a product page.
 *
 * Lifted out of the page, which had grown past the file-size limit while
 * holding this alongside its layout. This is business logic — which selections
 * are required, what counts as enough stock, what price actually goes into the
 * cart — and none of it is composition.
 *
 * The price written to the cart line is the *discounted* one, not the product's
 * base price. That is the whole reason this cannot be a one-liner in the button.
 *
 * Success opens the cart drawer; only the two ways to fail are toasts.
 */
'use client';

import { toast } from 'sonner';
import { useCart } from '@/components/CartProvider';
import { useCartDrawer } from '@/components/cart/CartDrawerProvider';
import { cartLineKey } from '@/lib/commerce/cart-input';
import type { ProductCardProduct } from '@/types/product';

interface UseAddProductToCartArgs {
  product: ProductCardProduct | null;
  selectedSize: string | undefined;
  selectedColor: string | undefined;
  quantity: number;
  currentStock: number;
  /** After any discount — see above. */
  finalPrice: number;
}

export function useAddProductToCart({
  product,
  selectedSize,
  selectedColor,
  quantity,
  currentStock,
  finalPrice,
}: UseAddProductToCartArgs) {
  const { addToCart } = useCart();
  const { openCart } = useCartDrawer();

  return function handleAddToCart(): void {
    if (!product) return;

    if (!selectedSize || !selectedColor) {
      toast.error('Please select both size and color before adding to cart');
      return;
    }

    if (currentStock < quantity) {
      toast.error(`Only ${currentStock} items available in stock`);
      return;
    }

    addToCart({
      productId: product.id,
      name: product.name,
      price: finalPrice,
      quantity,
      image: product.main_image ?? '',
      size: selectedSize,
      color: selectedColor,
    });

    // The confirmation. This was `getElementById('add-to-cart-button')` with
    // its textContent rewritten, which — with a desktop button and a sticky
    // mobile one both carrying that id — always found the desktop one, so a
    // phone got nothing back for the tap and shoppers added twice. The drawer
    // names the line it just added and is the same on both breakpoints.
    openCart(cartLineKey(product.id, selectedSize, selectedColor));
  };
}
