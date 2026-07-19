/** STOREFRONT layer — sitewide/category discount banner fetch + phase/countdown + "seen" tracking. */
import { useState, useEffect } from 'react';
import { Discount } from '@/lib/commerce/discounts';
import { DiscountPhase, computeStorefrontDiscountPhase, formatTimeDiff } from '@/lib/commerce/discount-phase';

export function useDiscountBanner() {
  const [activeDiscount, setActiveDiscount] = useState<Discount | null>(null);
  const [phase, setPhase] = useState<DiscountPhase>('NONE');
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    fetchDiscounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDiscounts = async () => {
    try {
      const res = await fetch('/api/discounts');
      const data = await res.json();
      if (data.success && data.discounts.length > 0) {
        determineBestDiscount(data.discounts);
      }
    } catch (e) {
      console.error('Failed to fetch discounts', e);
    }
  };

  // NOTE: deliberately distinct from Commerce's per-product getBestDiscount — this
  // picks a single SITEWIDE/CATEGORY discount to headline the global banner, not
  // the best price for a specific product. Do not merge with getBestDiscount.
  const determineBestDiscount = (allDiscounts: Discount[]) => {
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
    const best = sorted.find(d => {
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
    const { phase: computedPhase, showBanner: nextShowBanner } = computeStorefrontDiscountPhase(discount, new Date());

    setShowBanner(nextShowBanner);

    if (computedPhase !== 'NONE') {
      setPhase(computedPhase);
      checkModalVisibility(discount.id, computedPhase);
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

  return { activeDiscount, phase, showModal, showBanner, timeLeft, closeModal };
}
