'use client';

import React, { useState, useEffect } from 'react';
import { X, Tag, Clock, Sparkles } from 'lucide-react';
import { Discount } from '@/lib/discounts';

type DiscountPhase = 'STARTING_SOON' | 'DAY_1' | 'MIDDLE_DAY' | 'LAST_DAY' | 'NONE';

export default function StorefrontDiscountManager() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [activeDiscount, setActiveDiscount] = useState<Discount | null>(null);
  const [phase, setPhase] = useState<DiscountPhase>('NONE');
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  
  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      const res = await fetch('/api/discounts');
      const data = await res.json();
      if (data.success && data.discounts.length > 0) {
        setDiscounts(data.discounts);
        determineBestDiscount(data.discounts);
      }
    } catch (e) {
      console.error('Failed to fetch discounts', e);
    }
  };

  const determineBestDiscount = (allDiscounts: Discount[]) => {
    // Prefer Sitewide or Category over specific variants for the global banner
    const broadDiscounts = allDiscounts.filter(d => ['SITEWIDE', 'CATEGORY'].includes(d.scope));
    const targetDiscounts = broadDiscounts.length > 0 ? broadDiscounts : allDiscounts;
    
    if (targetDiscounts.length === 0) return;

    const now = new Date();
    
    // Sort by closest to starting, or currently active ending soonest
    const sorted = [...targetDiscounts].sort((a, b) => {
      const aStart = a.start_date ? new Date(a.start_date).getTime() : 0;
      const bStart = b.start_date ? new Date(b.start_date).getTime() : 0;
      return aStart - bStart;
    });

    // Find the most relevant one
    let best = sorted.find(d => {
      if (!d.start_date) return true;
      const end = d.end_date ? new Date(d.end_date) : new Date(8640000000000000);
      return now < end;
    });

    if (best) {
      setActiveDiscount(best);
      calculateState(best);
    }
  };

  const calculateState = (discount: Discount) => {
    const now = new Date();
    const start = discount.start_date ? new Date(discount.start_date) : now;
    const end = discount.end_date ? new Date(discount.end_date) : null;
    
    setShowBanner(true);

    if (now < start) {
      // Starting soon
      setPhase('STARTING_SOON');
      checkModalVisibility(discount.id, 'STARTING_SOON');
    } else if (!end) {
      // Active forever
      setPhase('DAY_1');
      checkModalVisibility(discount.id, 'DAY_1');
    } else {
      // It has an end date and has started
      const durationMs = end.getTime() - start.getTime();
      const days = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
      const currentDay = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      let computedPhase: DiscountPhase = 'NONE';
      
      if (currentDay === 1) {
        computedPhase = 'DAY_1';
      } else if (currentDay === days && days > 1) {
        computedPhase = 'LAST_DAY';
      } else if (days >= 5) {
        // Find middle day
        const middleDay = Math.floor(days / 2) + 1;
        if (currentDay === middleDay) {
          computedPhase = 'MIDDLE_DAY';
        }
      }

      if (computedPhase !== 'NONE') {
        setPhase(computedPhase);
        checkModalVisibility(discount.id, computedPhase);
      }
    }
  };

  const checkModalVisibility = (discountId: string, currentPhase: DiscountPhase) => {
    const storageKey = `discountModal_${discountId}_${currentPhase}`;
    const hasSeen = localStorage.getItem(storageKey);
    
    if (!hasSeen) {
      setShowModal(true);
    }
  };

  const closeModal = () => {
    if (activeDiscount) {
      const storageKey = `discountModal_${activeDiscount.id}_${phase}`;
      localStorage.setItem(storageKey, 'true');
    }
    setShowModal(false);
  };

  // Timer effect for banner
  useEffect(() => {
    if (!activeDiscount || !showBanner) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const start = activeDiscount.start_date ? new Date(activeDiscount.start_date) : now;
      const end = activeDiscount.end_date ? new Date(activeDiscount.end_date) : null;
      
      if (now < start) {
        const diff = start.getTime() - now.getTime();
        setTimeLeft(`Starts in ${formatTimeDiff(diff)}`);
      } else if (end && now < end) {
        const diff = end.getTime() - now.getTime();
        setTimeLeft(`Ends in ${formatTimeDiff(diff)}`);
      } else if (!end) {
        setTimeLeft('Active Now!');
      } else {
        setShowBanner(false);
        setShowModal(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeDiscount, showBanner]);

  const formatTimeDiff = (ms: number) => {
    const d = Math.floor(ms / (1000 * 60 * 60 * 24));
    const h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const getDiscountValueString = (d: Discount) => {
    return d.type === 'PERCENTAGE' ? `${d.value}% OFF` : `₦${d.value.toLocaleString()} OFF`;
  };

  if (!activeDiscount) return null;

  return (
    <>
      {/* Persistent Banner */}
      {showBanner && (
        <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm md:text-base font-medium flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
          <span className="font-bold">{activeDiscount.name}:</span>
          <span>{getDiscountValueString(activeDiscount)}</span>
          <span className="bg-blue-800 px-2 py-0.5 rounded-full text-xs font-bold ml-2">
            {timeLeft}
          </span>
        </div>
      )}

      {/* Smart Pop-up Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onMouseDown={closeModal}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-center relative">
              <button 
                onClick={closeModal}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                <Tag className="w-8 h-8 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-1">
                {phase === 'STARTING_SOON' && 'Coming Soon!'}
                {phase === 'DAY_1' && 'Sale is Live!'}
                {phase === 'MIDDLE_DAY' && 'Still Going Strong!'}
                {phase === 'LAST_DAY' && 'Last Chance!'}
              </h2>
            </div>
            
            <div className="p-8 text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{activeDiscount.name}</h3>
              
              <div className="text-4xl font-black text-blue-600 mb-4 tracking-tight">
                {getDiscountValueString(activeDiscount)}
              </div>
              
              <p className="text-gray-600 mb-6 leading-relaxed">
                {phase === 'STARTING_SOON' && `Get ready! This amazing offer kicks off very soon.`}
                {phase === 'DAY_1' && `We just launched our new discount. Shop now while stock lasts!`}
                {phase === 'MIDDLE_DAY' && `Don't miss out on this active offer. We're halfway through!`}
                {phase === 'LAST_DAY' && `Time is running out! Grab your favorites before the discount expires tonight.`}
              </p>
              
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-500 bg-gray-50 py-3 rounded-xl mb-6 border border-gray-100">
                <Clock className="w-4 h-4 text-blue-500" />
                {timeLeft}
              </div>
              
              <button 
                onClick={closeModal}
                className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-transform active:scale-95 shadow-lg shadow-gray-900/20"
              >
                Got it, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
