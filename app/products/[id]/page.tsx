/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// 214 lines: over the 200-line target. Already split into 2 hooks + 9 components;
// what remains is top-level page composition (loading/not-found states, layout grid,
// one addToCart handler). Splitting further would fragment straight-line composition
// into indirection without reducing complexity, so it's left as-is per CLAUDE.md.
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import { useWishlist } from '@/components/WishlistProvider';
import { getBestDiscount, calculateDiscountedPrice } from '@/lib/commerce/discounts';
import { getVariantPrice, getVariantStock } from '@/lib/commerce/pricing';
import { Skeleton } from '@/components/ui';
import { useProductDetail } from './hooks/useProductDetail';
import { useProductVariantSelection } from './hooks/useProductVariantSelection';
import ProductImageGallery from './components/ProductImageGallery';
import VariantSelector from './components/VariantSelector';
import StockStatusPanel from './components/StockStatusPanel';
import MobileProductBar from './components/MobileProductBar';
import AddToCartSection from './components/AddToCartSection';
import ProductDetailsAccordion from './components/ProductDetailsAccordion';
import DesktopProductHeader from './components/DesktopProductHeader';
import ProductPriceDisplay from './components/ProductPriceDisplay';
import OutOfStockNotice from './components/OutOfStockNotice';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { isInWishlist, addToWishlist, toggleWishlist } = useWishlist();

  const { product, discounts, loading } = useProductDetail(params.id as string | undefined);
  const {
    selectedSize,
    setSelectedSize,
    selectedColor,
    setSelectedColor,
    availableColors,
    currentImageIndex,
    setCurrentImageIndex,
  } = useProductVariantSelection(product);

  const [quantity, setQuantity] = useState(1);
  const isWishlisted = product ? isInWishlist(product.id) : false;

  const currentBasePrice = product ? getVariantPrice(product, selectedSize, selectedColor) : 0;
  const currentStock = product ? getVariantStock(product, selectedSize, selectedColor) : 0;
  const bestDiscount = product ? getBestDiscount(product, discounts, currentBasePrice, selectedSize, selectedColor) : null;
  const finalPrice = product ? calculateDiscountedPrice(currentBasePrice, bestDiscount) : 0;

  const handleAddToCart = () => {
    if (!product) return;

    if (!selectedSize || !selectedColor) {
      alert('Please select both size and color before adding to cart');
      return;
    }

    if (currentStock < quantity) {
      alert(`Only ${currentStock} items available in stock`);
      return;
    }

    addToCart({
      productId: product.id,
      name: product.name,
      price: finalPrice, // Use discounted price
      quantity,
      image: product.main_image,
      size: selectedSize,
      color: selectedColor
    });

    // Show success feedback
    // Judgment call: kept as direct DOM manipulation rather than React state.
    // There are two #add-to-cart-button elements in the DOM (mobile + desktop,
    // one CSS-hidden per breakpoint) and getElementById always grabs the first
    // (desktop) one — meaning on mobile this feedback silently updates the
    // hidden desktop button, not the visible mobile one. That's a pre-existing
    // quirk; converting to React state driving both buttons would fix it,
    // which counts as a behavior change, so it's left exactly as-is.
    const addButton = document.getElementById('add-to-cart-button');
    if (addButton) {
      const originalText = addButton.textContent;
      addButton.textContent = 'Added to Cart!';
      addButton.classList.add('bg-success');

      setTimeout(() => {
        addButton.textContent = originalText;
        addButton.classList.remove('bg-success');
      }, 1500);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="space-y-4">
          <Skeleton className="h-4 w-3/4 mx-auto" />
          <Skeleton className="h-8 w-1/2 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-h4 font-bold text-text-primary mb-4">Product not found</h1>
        <Link
          href="/products"
          className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-control font-semibold hover:bg-primary-hover"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  const productImages = [
    product.main_image,
    ...(product.images || [])
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background-secondary">
      <MobileProductBar
        product={product}
        currentBasePrice={currentBasePrice}
        currentStock={currentStock}
        isWishlisted={isWishlisted}
        onBack={() => router.back()}
        onToggleWishlist={() => toggleWishlist(product)}
      />

      <div className="container mx-auto px-4 py-4 md:py-8">
        {/* Desktop Back Button */}
        <div className="hidden md:flex mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            <span className="text-body-sm font-medium">Back</span>
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
          {/* Product Images */}
          <ProductImageGallery
            images={productImages}
            productName={product.name}
            currentIndex={currentImageIndex}
            onIndexChange={setCurrentImageIndex}
            currentStock={currentStock}
          />

          {/* Product Info */}
          <div className="px-1 md:px-0">
            <DesktopProductHeader
              product={product}
              currentBasePrice={currentBasePrice}
              currentStock={currentStock}
              isWishlisted={isWishlisted}
              onToggleWishlist={() => toggleWishlist(product)}
            />

            <div className="mb-4 md:mb-6">
              <h1 className="text-h4 md:text-h3 font-bold mb-2 md:mb-4 text-text-primary">
                {product.name}
              </h1>
              <p className="text-text-secondary text-body-md md:text-body-lg mb-4 md:mb-6">
                {product.description}
              </p>

              {/* Enhanced Stock Status */}
              <StockStatusPanel stock={currentStock} />

              <ProductPriceDisplay
                bestDiscount={bestDiscount}
                finalPrice={finalPrice}
                currentBasePrice={currentBasePrice}
              />
            </div>

            <VariantSelector
              sizes={product.sizes}
              colors={availableColors}
              selectedSize={selectedSize}
              selectedColor={selectedColor}
              onSelectSize={setSelectedSize}
              onSelectColor={setSelectedColor}
              currentStock={currentStock}
              sizingType={product.sizing_type}
            />

            <AddToCartSection
              currentStock={currentStock}
              quantity={quantity}
              onQuantityChange={setQuantity}
              selectedSize={selectedSize}
              selectedColor={selectedColor}
              finalPrice={finalPrice}
              onAddToCart={handleAddToCart}
            />

            {currentStock <= 0 && (
              <OutOfStockNotice isWishlisted={isWishlisted} onWishlist={() => addToWishlist(product)} />
            )}

            <ProductDetailsAccordion details={product.details} />
          </div>
        </div>
      </div>
    </div>
  );
}
