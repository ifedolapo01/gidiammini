/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The interactive half of the product page.
//
// This whole tree used to be page.tsx. The page is now a server component that
// fetches the product, exports generateMetadata, emits the structured data and
// hands the product down here — so the markup a crawler (or a WhatsApp
// preview) receives already contains the product, rather than `null` and a
// spinner. The composition did not change.
//
// Still a client component, and has to be: variant selection, quantity,
// wishlist and add-to-cart are all state. The read-only sections that carry
// text worth indexing (reviews, Q&A) are server-rendered and passed in.
'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useWishlist } from '@/components/WishlistProvider';
import { getBestDiscount, calculateDiscountedPrice, type Discount } from '@/lib/commerce/discounts';
import { getVariantPrice, getVariantStock } from '@/lib/commerce/pricing';
import { Product } from '@/types/product';
import { useProductVariantSelection } from '../hooks/useProductVariantSelection';
import ProductImageGallery from './ProductImageGallery';
import VariantSelector from './VariantSelector';
import MobileProductBar from './MobileProductBar';
import AddToCartSection from './AddToCartSection';
import ProductDetailsAccordion from './ProductDetailsAccordion';
import DesktopProductHeader from './DesktopProductHeader';
import ProductHeadlineBlock from './ProductHeadlineBlock';
import OutOfStockNotice from './OutOfStockNotice';
import { variantKeyFor } from '@/lib/commerce/product-variants';
import ProductRecommendations from './ProductRecommendations';
import { useAddProductToCart } from '../hooks/useAddProductToCart';
import type { ReviewStats } from '@/lib/commerce/rating-math';

interface ProductDetailViewProps {
  product: Product;
  discounts: Discount[];
  /** The published-review aggregate, for the star line under the name. */
  reviewStats: ReviewStats;
  /** categories.size_guidance, for the size guide. */
  categorySizeGuidance: string | null;
  /**
   * The reviews section, rendered on the server and handed in as a node: it
   * sits inside this layout, but passing it rather than importing it keeps its
   * markup server-rendered — the entire point of having review text at all.
   */
  reviews: ReactNode;
  /** The Q&A section. Same reasoning. */
  questions: ReactNode;
}

export default function ProductDetailView({
  product,
  discounts,
  reviewStats,
  categorySizeGuidance,
  reviews,
  questions,
}: ProductDetailViewProps) {
  const router = useRouter();
  const { isInWishlist, addToWishlist, toggleWishlist } = useWishlist();

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
  const isWishlisted = isInWishlist(product.id);

  const currentBasePrice = getVariantPrice(product, selectedSize, selectedColor);
  const currentStock = getVariantStock(product, selectedSize, selectedColor);
  const bestDiscount = getBestDiscount(product, discounts, currentBasePrice, selectedSize, selectedColor);
  const finalPrice = calculateDiscountedPrice(currentBasePrice, bestDiscount);

  const handleAddToCart = useAddProductToCart({
    product,
    selectedSize,
    selectedColor,
    quantity,
    currentStock,
    finalPrice,
  });

  const productImages = [product.main_image, ...(product.images || [])].filter(Boolean);

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
        {/* Phones get this in MobileProductBar instead. */}
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

            <ProductHeadlineBlock
              product={product}
              currentBasePrice={currentBasePrice}
              currentStock={currentStock}
              finalPrice={finalPrice}
              bestDiscount={bestDiscount}
              reviewStats={reviewStats}
            />

            <VariantSelector
              product={product}
              colors={availableColors}
              selectedSize={selectedSize}
              selectedColor={selectedColor}
              onSelectSize={setSelectedSize}
              onSelectColor={setSelectedColor}
              currentStock={currentStock}
              categoryGuidance={categorySizeGuidance}
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
              <OutOfStockNotice
                productId={product.id}
                // Only when the shopper has actually picked one. A half-chosen
                // variant would record a request for something they never
                // selected.
                variantKey={
                  selectedSize && selectedColor
                    ? variantKeyFor(selectedSize, selectedColor)
                    : null
                }
                isWishlisted={isWishlisted}
                onWishlist={() => addToWishlist(product)}
              />
            )}

            <ProductDetailsAccordion details={product.details} />
          </div>
        </div>

        {/* Before the rails: what buyers said is worth more to someone still
            deciding than a suggestion to look at a different product. */}
        {reviews}

        {/* Under the reviews: somebody who has read what buyers said and still
            has a doubt is who the Q&A is for. */}
        {questions}

        {/* The rails run the full width of the page, under both columns, which
            is where a suggestion belongs — after the decision about this
            product, not beside it. */}
        <ProductRecommendations productId={product.id} />
      </div>
    </div>
  );
}
