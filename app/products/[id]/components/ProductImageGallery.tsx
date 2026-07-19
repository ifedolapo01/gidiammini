/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui';

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  currentStock: number;
}

export default function ProductImageGallery({ images, productName, currentIndex, onIndexChange, currentStock }: ProductImageGalleryProps) {
  return (
    <div>
      {/* Main Image */}
      <div className="relative rounded-surface overflow-hidden shadow-elevation-3 mb-3 md:mb-4 bg-surface">
        <div className="w-full">
          <img
            src={images[currentIndex]}
            alt={productName}
            className="w-full h-auto block"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.jpg';
            }}
          />
        </div>

        {/* Stock Badge on Image */}
        {currentStock <= 5 && currentStock > 0 && (
          <Badge tone="warning" variant="solid" className="absolute top-4 left-4">
            {currentStock <= 3 ? `Only ${currentStock} left!` : 'Low Stock'}
          </Badge>
        )}
        {currentStock === 0 && (
          <Badge tone="destructive" variant="solid" className="absolute top-4 left-4">
            Out of Stock
          </Badge>
        )}

        {/* Image Navigation Dots (Mobile) */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 md:hidden">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => onIndexChange(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  currentIndex === index
                    ? 'bg-primary w-4'
                    : 'bg-surface/60'
                }`}
                aria-label={`View image ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Desktop Image Navigation Arrows */}
        {images.length > 1 && (
          <div className="hidden md:block">
            <button
              onClick={() => onIndexChange(currentIndex > 0 ? currentIndex - 1 : images.length - 1)}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-surface/80 p-2 rounded-full hover:bg-surface transition-all"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => onIndexChange(currentIndex < images.length - 1 ? currentIndex + 1 : 0)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-surface/80 p-2 rounded-full hover:bg-surface transition-all"
              aria-label="Next image"
            >
              <ChevronLeft className="w-5 h-5 rotate-180" />
            </button>
          </div>
        )}
      </div>

      {/* Thumbnail Gallery - Desktop */}
      {images.length > 1 && (
        <>
          <div className="hidden md:grid md:grid-cols-4 gap-2">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => onIndexChange(idx)}
                className={`border rounded-control overflow-hidden hover:border-primary transition-all ${
                  currentIndex === idx ? 'border-2 border-primary' : ''
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
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => onIndexChange(idx)}
                  className={`flex-shrink-0 w-20 h-20 border rounded-control overflow-hidden ${
                    currentIndex === idx ? 'border-2 border-primary' : 'border-border-strong'
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
  );
}
