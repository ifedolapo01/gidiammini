'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useCart } from '@/components/CartProvider';
import { getProduct } from '@/lib/supabase/actions';
import { createClient } from '@/lib/supabase/client';
import { Truck, Shield, ChevronLeft, Share2, Heart, Check, Package, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Product } from '@/types/product';
import { Discount, getBestDiscount, calculateDiscountedPrice } from '@/lib/discounts';
import { getVariantPrice } from '@/lib/pricing';


export default function ProductDetailPage() {
  const params = useParams();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [params.id]);

  const loadProduct = async () => {
    if (!params.id) return;
    
    setLoading(true);
    try {
      const data = await getProduct(params.id as string);
      setProduct(data);
      
      // Set default selections if available
      if (data) {
        if (data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
        }
        if (data.colors.length > 0) {
          setSelectedColor(data.colors[0]);
        }
      }

      // Fetch active discounts
      const supabase = createClient();
      const { data: discountsData } = await supabase
        .from('discounts')
        .select('*')
        .eq('is_active', true);
      
      if (discountsData) {
        setDiscounts(discountsData as Discount[]);
      }

    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVariantStock = (product: Product, size: string | null, color: string | null) => {
    if (!product.pricing_config) return product.stock;
    
    const config = product.pricing_config as any;
    if (config.mode === 'single') {
      return config.singleStock !== undefined ? config.singleStock : product.stock;
    }
    if (config.mode === 'size' && size) {
      return config.sizeStock?.[size] ?? product.stock;
    }
    if (config.mode === 'color' && color) {
      return config.colorStock?.[color] ?? product.stock;
    }
    if (config.mode === 'combination' && size && color) {
      return config.combinationStock?.[`${size}|${color}`] ?? product.stock;
    }
    return product.stock;
  };

  const currentBasePrice = product ? getVariantPrice(product, selectedSize, selectedColor) : 0;
  const currentStock = product ? getVariantStock(product, selectedSize, selectedColor) : 0;
  const bestDiscount = product ? getBestDiscount(product, discounts, currentBasePrice) : null;
  const finalPrice = product ? calculateDiscountedPrice(currentBasePrice, bestDiscount) : 0;

  // Derive available colors based on selected size for combination mode
  const availableColors = useMemo(() => {
    if (!product || !product.pricing_config) return product?.colors || [];
    const config = product.pricing_config as any;
    
    if (config.mode === 'combination' && selectedSize) {
      const combinationPrices = config.combinationPrices || {};
      const colorsForSize = Object.keys(combinationPrices)
        .filter(key => key.startsWith(`${selectedSize}|`))
        .map(key => key.split('|')[1]);
      return colorsForSize.length > 0 ? colorsForSize : (product.colors || []);
    }
    
    return product.colors || [];
  }, [product, selectedSize]);

  // When selected size changes, ensure selected color is valid for that size
  useEffect(() => {
    if (availableColors.length > 0 && selectedColor && !availableColors.includes(selectedColor)) {
      setSelectedColor(availableColors[0]);
    }
  }, [selectedSize, availableColors, selectedColor]);

  // When selected color changes, swap the main image if a mapped image exists
  useEffect(() => {
    if (product && selectedColor && product.pricing_config) {
      const config = product.pricing_config as any;
      if (config.colorImages && config.colorImages[selectedColor]) {
        const targetUrl = config.colorImages[selectedColor];
        const allImages = [product.main_image, ...(product.images || [])].filter(Boolean);
        const index = allImages.indexOf(targetUrl);
        if (index !== -1) {
          setCurrentImageIndex(index);
        }
      }
    }
  }, [selectedColor, product]);

  const handleShare = async (platform?: string) => {
    if (!product) return;
    
    setIsSharing(true);
    const url = window.location.href;
    const title = `Check out ${product.name} on GidiamMini`;
    const text = `${product.name} - ₦${currentBasePrice.toLocaleString()}\n${product.description || ''}`;
    
    try {
      if (platform === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank');
      } else if (platform === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank');
      } else if (platform === 'facebook') {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
      } else if (platform === 'copy') {
        await navigator.clipboard.writeText(`${title}\n${url}`);
        alert('Link copied to clipboard!');
      } else if (navigator.share) {
        // Use Web Share API if available (mobile devices)
        await navigator.share({
          title,
          text,
          url,
        });
      } else {
        // Fallback for desktop without Web Share API
        setShowShareOptions(true);
      }
    } catch (error) {
      console.error('Error sharing:', error);
    } finally {
      setIsSharing(false);
      setShowShareOptions(false);
    }
  };

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
    const addButton = document.getElementById('add-to-cart-button');
    if (addButton) {
      const originalText = addButton.textContent;
      addButton.textContent = 'Added to Cart!';
      addButton.classList.add('bg-green-600');
      
      setTimeout(() => {
        addButton.textContent = originalText;
        addButton.classList.remove('bg-green-600');
      }, 1500);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-700 mb-4">Product not found</h1>
        <Link
          href="/products"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
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

  // Enhanced Stock Status Component
  const StockStatus = ({ stock }: { stock: number }) => {
    if (stock > 10) {
      return (
        <div className="flex items-center">
          <Check className="w-5 h-5 text-green-500 mr-2" />
          <div>
            <span className="text-green-600 font-medium">In Stock</span>
            <span className="text-gray-500 text-sm ml-2">
              ({stock} available)
            </span>
            <p className="text-xs text-green-700 mt-1">
              • Ready to ship within 24 hours
            </p>
          </div>
        </div>
      );
    } else if (stock > 5) {
      return (
        <div className="flex items-center">
          <Check className="w-5 h-5 text-green-500 mr-2" />
          <div>
            <span className="text-green-600 font-medium">In Stock</span>
            <span className="text-gray-500 text-sm ml-2">
              ({stock} available)
            </span>
            <p className="text-xs text-green-700 mt-1">
              • Limited quantity available
            </p>
          </div>
        </div>
      );
    } else if (stock > 0) {
      return (
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
          <div>
            <span className="text-yellow-600 font-medium">Low Stock</span>
            <span className="text-gray-500 text-sm ml-2">
              (Only {stock} left)
            </span>
            <p className="text-xs text-yellow-700 mt-1">
              • Selling fast! Order now to secure your item
            </p>
          </div>
        </div>
      );
    } else if (stock === 0) {
      return (
        <div className="flex items-center">
          <Package className="w-5 h-5 text-red-500 mr-2" />
          <div>
            <span className="text-red-600 font-medium">Out of Stock</span>
            <span className="text-gray-500 text-sm ml-2">
              (Currently unavailable)
            </span>
            <p className="text-xs text-red-700 mt-1">
              • Check back soon for restock updates
              <br />
              • Contact us for estimated restock date
            </p>
          </div>
        </div>
      );
    } else {
      // Stock is negative (shouldn't happen, but just in case)
      return (
        <div className="flex items-center text-red-600">
          <Package className="w-5 h-5 mr-2" />
          <span className="font-medium">Inventory Error</span>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Back Button & Actions */}
      <div className="sticky top-0 z-40 bg-white border-b md:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/products"
            className="flex items-center text-gray-700"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            <span className="text-sm">Back</span>
          </Link>
          
          <div className="flex items-center space-x-3">
            <button 
              className="p-2 hover:bg-gray-100 rounded-full"
              onClick={() => setIsWishlisted(!isWishlisted)}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              disabled={currentStock <= 0}
            >
              <Heart 
                className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-500'} ${currentStock <= 0 ? 'opacity-50' : ''}`} 
              />
            </button>
            <div className="relative">
              <button 
                className="p-2 hover:bg-gray-100 rounded-full"
                onClick={() => handleShare()}
                aria-label="Share product"
                disabled={isSharing || currentStock <= 0}
              >
                <Share2 className={`w-5 h-5 ${isSharing ? 'text-gray-300' : 'text-gray-500'} ${currentStock <= 0 ? 'opacity-50' : ''}`} />
              </button>
              
              {showShareOptions && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                  <div className="p-2">
                    <button
                      onClick={() => handleShare('whatsapp')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded text-sm flex items-center"
                    >
                      <span className="mr-2">📱</span> WhatsApp
                    </button>
                    <button
                      onClick={() => handleShare('twitter')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded text-sm flex items-center"
                    >
                      <span className="mr-2">🐦</span> Twitter
                    </button>
                    <button
                      onClick={() => handleShare('facebook')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded text-sm flex items-center"
                    >
                      <span className="mr-2">👍</span> Facebook
                    </button>
                    <button
                      onClick={() => handleShare('copy')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded text-sm flex items-center"
                    >
                      <span className="mr-2">📋</span> Copy Link
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
          {/* Product Images */}
          <div>
            {/* Main Image */}
            <div className="relative rounded-xl md:rounded-2xl overflow-hidden shadow-lg mb-3 md:mb-4 bg-white">
              <div className="w-full">
                <img
                  src={productImages[currentImageIndex]}
                  alt={product.name}
                  className="w-full h-auto block"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.jpg';
                  }}
                />
              </div>
              
              {/* Stock Badge on Image */}
              {currentStock <= 5 && currentStock > 0 && (
                <div className="absolute top-4 left-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {currentStock <= 3 ? `Only ${currentStock} left!` : 'Low Stock'}
                </div>
              )}
              {currentStock === 0 && (
                <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Out of Stock
                </div>
              )}
              
              {/* Image Navigation Dots (Mobile) */}
              {productImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 md:hidden">
                  {productImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        currentImageIndex === index 
                          ? 'bg-blue-600 w-4' 
                          : 'bg-white bg-opacity-60'
                      }`}
                      aria-label={`View image ${index + 1}`}
                    />
                  ))}
                </div>
              )}
              
              {/* Desktop Image Navigation Arrows */}
              {productImages.length > 1 && (
                <div className="hidden md:block">
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : productImages.length - 1)}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full hover:bg-opacity-100 transition-all"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev < productImages.length - 1 ? prev + 1 : 0)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full hover:bg-opacity-100 transition-all"
                    aria-label="Next image"
                  >
                    <ChevronLeft className="w-5 h-5 rotate-180" />
                  </button>
                </div>
              )}
            </div>
            
            {/* Thumbnail Gallery - Desktop */}
            {productImages.length > 1 && (
              <>
                <div className="hidden md:grid md:grid-cols-4 gap-2">
                  {productImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`border rounded-lg overflow-hidden hover:border-blue-500 transition-all ${
                        currentImageIndex === idx ? 'border-2 border-blue-500' : ''
                      }`}
                    >
                      <img 
                        src={img} 
                        alt={`Thumbnail ${idx + 1}`} 
                        className="w-full h-20 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.jpg';
                        }}
                      />
                    </button>
                  ))}
                </div>
                
                {/* Mobile Thumbnail Swipe (Horizontal Scroll) */}
                <div className="md:hidden overflow-x-auto pb-2 -mx-4 px-4">
                  <div className="flex space-x-3 w-max">
                    {productImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`flex-shrink-0 w-20 h-20 border rounded-lg overflow-hidden ${
                          currentImageIndex === idx ? 'border-2 border-blue-500' : 'border-gray-300'
                        }`}
                      >
                        <img 
                          src={img} 
                          alt={`Thumbnail ${idx + 1}`} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.jpg';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Product Info */}
          <div className="px-1 md:px-0">
            {/* Category & Wishlist - Desktop */}
            <div className="hidden md:flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm capitalize">
                  {product.category}
                </span>
                {currentStock <= 5 && currentStock > 0 && (
                  <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    {currentStock <= 3 ? `Only ${currentStock} left!` : 'Low Stock'}
                  </span>
                )}
                {currentStock === 0 && (
                  <span className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                    Out of Stock
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  disabled={currentStock <= 0}
                >
                  <Heart 
                    className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} 
                  />
                </button>
                <div className="relative">
                  <button 
                    className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleShare()}
                    aria-label="Share product"
                    disabled={isSharing || currentStock <= 0}
                  >
                    <Share2 className={`w-5 h-5 ${isSharing ? 'text-gray-300' : 'text-gray-500'}`} />
                  </button>
                  
                  {showShareOptions && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                      <div className="p-2">
                        <button
                          onClick={() => handleShare('whatsapp')}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded text-sm flex items-center"
                        >
                          <span className="mr-2">📱</span> WhatsApp
                        </button>
                        <button
                          onClick={() => handleShare('twitter')}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded text-sm flex items-center"
                        >
                          <span className="mr-2">🐦</span> Twitter
                        </button>
                        <button
                          onClick={() => handleShare('facebook')}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded text-sm flex items-center"
                        >
                          <span className="mr-2">👍</span> Facebook
                        </button>
                        <button
                          onClick={() => handleShare('copy')}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded text-sm flex items-center"
                        >
                          <span className="mr-2">📋</span> Copy Link
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mb-4 md:mb-6">
              <h1 className="text-2xl md:text-3xl font-bold mb-2 md:mb-4 text-gray-900">
                {product.name}
              </h1>
              <p className="text-gray-600 text-base md:text-lg mb-4 md:mb-6">
                {product.description}
              </p>
              
              {/* Enhanced Stock Status */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <StockStatus stock={currentStock} />
              </div>

              {/* Price */}
              <div className="mb-6 md:mb-8 flex items-end gap-3">
                {bestDiscount ? (
                  <>
                    <div className="text-3xl md:text-4xl font-bold text-red-600">
                      ₦{finalPrice.toLocaleString()}
                    </div>
                    <div className="text-xl text-gray-400 line-through mb-1">
                      ₦{currentBasePrice.toLocaleString()}
                    </div>
                    <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-bold mb-1">
                      {bestDiscount.type === 'PERCENTAGE' ? `${bestDiscount.value}% OFF` : `Save ₦${bestDiscount.value}`}
                    </div>
                  </>
                ) : (
                  <div className="text-3xl md:text-4xl font-bold text-gray-900">
                    ₦{currentBasePrice.toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Size Selector */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-6 md:mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-base md:text-lg text-black">Select {product.sizing_type === 'age' ? 'Age' : 'Size'}</h3>
                  {currentStock <= 0 && (
                    <span className="text-sm text-red-600 font-medium">
                      Out of Stock - Cannot select {product.sizing_type === 'age' ? 'age' : 'size'}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => currentStock > 0 && setSelectedSize(size)}
                      className={`px-4 py-3 md:px-4 md:py-2 border rounded-lg transition-all text-sm md:text-base ${
                        selectedSize === size && currentStock > 0
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'hover:border-gray-400 text-gray-700'
                      } ${currentStock <= 0 ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
                      aria-pressed={selectedSize === size}
                      disabled={currentStock <= 0}
                    >
                      {size.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selector */}
            {availableColors.length > 0 && (
              <div className="mb-6 md:mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-base md:text-lg text-black">Select Color</h3>
                  {currentStock <= 0 && (
                    <span className="text-sm text-red-600 font-medium">
                      Out of Stock - Cannot select color
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map(color => (
                    <button
                      key={color}
                      onClick={() => currentStock > 0 && setSelectedColor(color)}
                      className={`px-4 py-3 md:px-4 md:py-2 border rounded-lg flex items-center transition-all text-gray-900 ${
                        selectedColor === color && currentStock > 0
                          ? 'border-blue-700 bg-blue-100 text-gray-900'
                          : 'hover:border-gray-400'
                      } ${currentStock <= 0 ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
                      aria-pressed={selectedColor === color}
                      disabled={currentStock <= 0}
                    >
                      <span className="text-sm md:text-base">{color.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity & Add to Cart - Desktop */}
            {currentStock > 0 && (
              <div className="md:mb-8">
                <div className="hidden md:flex items-center gap-4 mb-6">
                  <div className="flex items-center border rounded-lg text-black">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-4 py-3 hover:bg-gray-50 text-lg disabled:opacity-50"
                      aria-label="Decrease quantity"
                      disabled={quantity <= 1}
                    >
                      -
                    </button>
                    <span className="px-4 py-3 w-12 text-center">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                      className="px-4 py-3 hover:bg-gray-50 text-lg disabled:opacity-50"
                      aria-label="Increase quantity"
                      disabled={quantity >= currentStock}
                    >
                      +
                    </button>
                  </div>
                  <button
                    id="add-to-cart-button"
                    onClick={handleAddToCart}
                    disabled={!selectedSize || !selectedColor}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all text-base md:text-lg"
                  >
                    {!selectedSize || !selectedColor ? 'Select Options' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Bottom Sticky Add to Cart */}
            {currentStock > 0 ? (
              <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="font-bold text-xl text-blue-600">₦{(finalPrice * quantity).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center border rounded-lg border-gray-800">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-4 py-3 text-black hover:bg-gray-50 disabled:opacity-50"
                      aria-label="Decrease quantity"
                      disabled={quantity <= 1}
                    >
                      -
                    </button>
                    <span className="px-4 py-3 w-10 text-center text-black">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                      className="px-4 py-3 text-black hover:bg-gray-50 disabled:opacity-50"
                      aria-label="Increase quantity"
                      disabled={quantity >= currentStock}
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  id="add-to-cart-button"
                  onClick={handleAddToCart}
                  disabled={!selectedSize || !selectedColor}
                  className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all text-lg"
                >
                  {!selectedSize || !selectedColor ? 'Select Options' : 'Add to Cart'}
                </button>
              </div>
            ) : (
              <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 p-4">
                <div className="text-center">
                  <p className="text-red-600 font-medium mb-2">This item is currently out of stock</p>
                  <button
                    onClick={() => window.location.href = '/products'}
                    className="w-full bg-gray-800 text-white py-4 rounded-lg font-semibold hover:bg-gray-900 transition-all text-lg"
                  >
                    Browse Other Products
                  </button>
                </div>
              </div>
            )}

            {/* Out of Stock Message */}
            {currentStock <= 0 && (
              <div className="mb-6 md:mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-bold text-red-900 mb-2 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Currently Unavailable
                </h4>
                <p className="text-red-800 text-sm">
                  This product is out of stock. We're working to restock it as soon as possible.
                </p>
                <div className="mt-3 space-y-2">
                  <button
                    onClick={() => window.location.href = '/products'}
                    className="w-full bg-gray-800 text-white py-3 rounded-lg font-medium hover:bg-gray-900"
                  >
                    Browse Available Products
                  </button>
                  <button
                    onClick={() => setIsWishlisted(true)}
                    className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50"
                  >
                    {isWishlisted ? '✓ Added to Wishlist' : 'Add to Wishlist'}
                  </button>
                </div>
              </div>
            )}

            {/* Features & Details */}
            <div className="space-y-4 border-t pt-6 md:pt-8 mt-6 md:mt-0">
              {/* Product Details List */}
              {product.details && product.details.length > 0 && (
                <div className="border rounded-lg border-gray-900">
                  <details className="group" open>
                    <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                      <span className="font-medium text-gray-900">Product Details</span>
                      <ChevronLeft className="w-5 h-5 transform group-open:rotate-90 transition-transform text-gray-900" />
                    </summary>
                    <div className="px-4 pb-4 text-gray-600">
                      <ul className="space-y-2 text-sm md:text-base">
                        {product.details.map((detail, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-blue-500 mr-2">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                </div>
              )}

              {/* Shipping & Returns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                  <Truck className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Free Shipping</p>
                    <p className="text-sm text-gray-600">On orders over ₦50,000 in Abuja</p>
                  </div>
                </div>
                <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                  <Shield className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Easy Returns</p>
                    <p className="text-sm text-gray-600">30-day return policy</p>
                  </div>
                </div>
              </div>

              {/* Delivery Info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Delivery Information</h4>
                <p className="text-sm text-blue-800">
                  • Abuja: 1-2 days<br/>
                  • Other states: 3-5 business days to designated parks<br/>
                  • Contact us for expedited shipping
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to convert color names to hex values
function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    'White': '#FFFFFF',
    'Black': '#000000',
    'Navy': '#000080',
    'Charcoal': '#36454F',
    'Olive': '#808000',
    'Burgundy': '#800020',
    'Khaki': '#C3B091',
    'Grey': '#808080',
    'Gray': '#808080',
    'Emerald': '#50C878',
    'Dusty Rose': '#DCAE96',
    'Plum': '#8E4585',
    'Light Wash': '#6F8FAF',
    'Dark Wash': '#1C2841',
    'Red': '#FF0000',
    'Blue': '#0000FF',
    'Green': '#008000',
    'Yellow': '#FFFF00',
    'Pink': '#FFC0CB',
    'Purple': '#800080',
    'Orange': '#FFA500',
    'Brown': '#A52A2A',
    'Beige': '#F5F5DC',
    'Cream': '#FFFDD0',
    'Maroon': '#800000',
    'Teal': '#008080',
    'Turquoise': '#40E0D0',
    'Lavender': '#E6E6FA',
    'Mint': '#98FF98'
  };
  
  return colorMap[colorName] || '#CCCCCC';
}