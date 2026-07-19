/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Product } from '@/types/product';

interface ProductShareMenuProps {
  product: Product;
  currentBasePrice: number;
  currentStock: number;
  /** Matches the two distinct className treatments used in the mobile sticky header vs desktop header. */
  variant?: 'mobile' | 'desktop';
}

export default function ProductShareMenu({ product, currentBasePrice, currentStock, variant = 'desktop' }: ProductShareMenuProps) {
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async (platform?: string) => {
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
        await navigator.share({ title, text, url });
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

  const buttonClassName = variant === 'desktop'
    ? 'p-2 hover:bg-surface-hover rounded-full disabled:opacity-50 disabled:cursor-not-allowed'
    : 'p-2 hover:bg-surface-hover rounded-full';

  const iconClassName = variant === 'desktop'
    ? `w-5 h-5 ${isSharing ? 'text-text-muted' : 'text-text-secondary'}`
    : `w-5 h-5 ${isSharing ? 'text-text-muted' : 'text-text-secondary'} ${currentStock <= 0 ? 'opacity-50' : ''}`;

  return (
    <div className="relative">
      <button
        className={buttonClassName}
        onClick={() => handleShare()}
        aria-label="Share product"
        disabled={isSharing || currentStock <= 0}
      >
        <Share2 className={iconClassName} />
      </button>

      {showShareOptions && (
        <div className="absolute right-0 mt-2 w-48 bg-surface rounded-surface shadow-elevation-3 border z-50">
          <div className="p-2">
            <button
              onClick={() => handleShare('whatsapp')}
              className="w-full text-left px-4 py-2 hover:bg-surface-hover rounded-control text-body-sm flex items-center"
            >
              <span className="mr-2">📱</span> WhatsApp
            </button>
            <button
              onClick={() => handleShare('twitter')}
              className="w-full text-left px-4 py-2 hover:bg-surface-hover rounded-control text-body-sm flex items-center"
            >
              <span className="mr-2">🐦</span> Twitter
            </button>
            <button
              onClick={() => handleShare('facebook')}
              className="w-full text-left px-4 py-2 hover:bg-surface-hover rounded-control text-body-sm flex items-center"
            >
              <span className="mr-2">👍</span> Facebook
            </button>
            <button
              onClick={() => handleShare('copy')}
              className="w-full text-left px-4 py-2 hover:bg-surface-hover rounded-control text-body-sm flex items-center"
            >
              <span className="mr-2">📋</span> Copy Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
