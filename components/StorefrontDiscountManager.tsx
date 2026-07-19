/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { X, Tag, Clock, Sparkles } from 'lucide-react';
import { formatDiscountValue } from '@/lib/commerce/discounts';
import { Badge, Modal } from '@/components/ui';
import { useDiscountBanner } from '@/components/hooks/useDiscountBanner';

export default function StorefrontDiscountManager() {
  const { activeDiscount, phase, showModal, showBanner, timeLeft, closeModal } = useDiscountBanner();

  if (!activeDiscount) return null;

  return (
    <>
      {/* Persistent Banner */}
      {showBanner && (
        <div className="bg-info text-text-inverse px-4 py-2 text-center text-body-sm md:text-body-md font-medium flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-accent animate-pulse" />
          <span className="font-bold">{activeDiscount.name}:</span>
          <span>{formatDiscountValue(activeDiscount)}</span>
          <Badge tone="info" variant="solid" className="ml-2">
            {timeLeft}
          </Badge>
        </div>
      )}

      {/* Smart Pop-up Modal */}
      <Modal open={showModal} onClose={closeModal} size="sm" hideHeader padded={false} ariaLabel={activeDiscount.name}>
        <div className="bg-gradient-to-r from-info to-info/80 p-6 text-center relative rounded-t-overlay">
          <button
            onClick={closeModal}
            aria-label="Close"
            className="absolute top-4 right-4 text-text-inverse/80 hover:text-text-inverse transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 bg-text-inverse/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <Tag className="w-8 h-8 text-text-inverse" />
          </div>

          <h2 className="text-h4 font-bold text-text-inverse mb-1">
            {phase === 'STARTING_SOON' && 'Coming Soon!'}
            {phase === 'DAY_1' && 'Sale is Live!'}
            {phase === 'MIDDLE_DAY' && 'Still Going Strong!'}
            {phase === 'LAST_DAY' && 'Last Chance!'}
          </h2>
        </div>

        <div className="p-8 text-center">
          <h3 className="text-h5 font-bold text-text-primary mb-2">{activeDiscount.name}</h3>

          <div className="text-h2 font-black text-info mb-4 tracking-tight">
            {formatDiscountValue(activeDiscount)}
          </div>

          <p className="text-text-secondary mb-6 leading-relaxed">
            {phase === 'STARTING_SOON' && `Get ready! This amazing offer kicks off very soon.`}
            {phase === 'DAY_1' && `We just launched our new discount. Shop now while stock lasts!`}
            {phase === 'MIDDLE_DAY' && `Don't miss out on this active offer. We're halfway through!`}
            {phase === 'LAST_DAY' && `Time is running out! Grab your favorites before the discount expires tonight.`}
          </p>

          <div className="flex items-center justify-center gap-2 text-body-sm font-semibold text-text-secondary bg-background-secondary py-3 rounded-control mb-6 border border-border-light">
            <Clock className="w-4 h-4 text-info" />
            {timeLeft}
          </div>

          <button
            onClick={closeModal}
            className="w-full bg-surface-inverse text-on-inverse font-bold py-4 rounded-control hover:opacity-90 transition-transform active:scale-95 shadow-elevation-3"
          >
            Got it, Thanks!
          </button>
        </div>
      </Modal>
    </>
  );
}
