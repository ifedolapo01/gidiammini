// lib/commerce/discount-phase.ts
// Pure phase-computation helpers for the discount promotional lifecycle.
// Distinctly-named exports may coexist here for different consumers - e.g.
// the discounts cron job (deciding whether to send a promo email) versus a
// storefront banner (deciding what to display). Do not overwrite another
// export when adding to this file; add alongside it instead.

export type DiscountPhase = 'STARTING_SOON' | 'DAY_1' | 'MIDDLE_DAY' | 'LAST_DAY' | 'NONE';

export interface DiscountPhaseInput {
  start_date?: string | null;
  end_date?: string | null;
}

/**
 * Computes which lifecycle phase a discount is currently in, for the purpose
 * of deciding whether the discounts cron job should send a promotional email.
 * Mirrors the logic previously inlined in app/api/cron/discounts/route.ts.
 */
export function computeDiscountPhase(discount: DiscountPhaseInput, now: Date): DiscountPhase {
  const start = discount.start_date ? new Date(discount.start_date) : now;
  const end = discount.end_date ? new Date(discount.end_date) : null;

  let computedPhase: DiscountPhase = 'NONE';

  if (now < start) {
    // Check if starting in less than 24 hours
    const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 24) {
      computedPhase = 'STARTING_SOON';
    }
  } else if (!end) {
    computedPhase = 'DAY_1';
  } else {
    const durationMs = end.getTime() - start.getTime();
    const days = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    const currentDay = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (currentDay === 1) {
      computedPhase = 'DAY_1';
    } else if (currentDay === days && days > 1) {
      computedPhase = 'LAST_DAY';
    } else if (days >= 5) {
      const middleDay = Math.floor(days / 2) + 1;
      if (currentDay === middleDay) {
        computedPhase = 'MIDDLE_DAY';
      }
    }
  }

  return computedPhase;
}

export interface StorefrontDiscountPhaseResult {
  phase: DiscountPhase;
  /** The storefront banner is shown for any discount passed in — always true here. */
  showBanner: boolean;
}

/**
 * Computes which lifecycle phase a discount is currently in, for the purpose of
 * the storefront promo banner/modal (StorefrontDiscountManager). Distinct from
 * computeDiscountPhase above: here STARTING_SOON covers the whole pre-start window
 * (no 24h cutoff), matching the storefront's original inlined `calculateState` logic.
 */
export function computeStorefrontDiscountPhase(discount: DiscountPhaseInput, now: Date): StorefrontDiscountPhaseResult {
  const start = discount.start_date ? new Date(discount.start_date) : now;
  const end = discount.end_date ? new Date(discount.end_date) : null;

  if (now < start) {
    return { phase: 'STARTING_SOON', showBanner: true };
  }

  if (!end) {
    return { phase: 'DAY_1', showBanner: true };
  }

  const durationMs = end.getTime() - start.getTime();
  const days = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
  const currentDay = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  let phase: DiscountPhase = 'NONE';

  if (currentDay === 1) {
    phase = 'DAY_1';
  } else if (currentDay === days && days > 1) {
    phase = 'LAST_DAY';
  } else if (days >= 5) {
    const middleDay = Math.floor(days / 2) + 1;
    if (currentDay === middleDay) {
      phase = 'MIDDLE_DAY';
    }
  }

  return { phase, showBanner: true };
}

/** Formats a millisecond duration as a compact countdown string, e.g. "2d 4h 30m" / "1h 5m 20s" / "3m 10s". */
export function formatTimeDiff(ms: number): string {
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  const h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((ms % (1000 * 60)) / 1000);

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}
