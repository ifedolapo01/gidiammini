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
 */
'use client';

import { toast } from 'sonner';
import { useCart } from '@/components/CartProvider';
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

/**
 * Momentary "Added to Cart!" feedback on the button.
 *
 * Judgment call, preserved as it was: kept as direct DOM manipulation rather
 * than React state. There are two #add-to-cart-button elements in the DOM
 * (mobile + desktop, one CSS-hidden per breakpoint) and getElementById always
 * grabs the first (desktop) one — so on mobile this updates the hidden desktop
 * button, not the visible one. That is a pre-existing quirk; converting it to
 * state driving both buttons would be a behaviour change, so it stays as-is.
 */
function flashAddedFeedback(): void {
  const addButton = document.getElementById('add-to-cart-button');
  if (!addButton) return;

  const originalText = addButton.textContent;
  addButton.textContent = 'Added to Cart!';
  addButton.classList.add('bg-success');

  setTimeout(() => {
    addButton.textContent = originalText;
    addButton.classList.remove('bg-success');
  }, 1500);
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

    flashAddedFeedback();
  };
}
