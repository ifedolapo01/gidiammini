/**
 * STOREFRONT layer — one attempt at a checkout: where it is, and what it holds.
 *
 * The flow's three steps used to be `useState`, with the order number, the
 * total and the idempotency key alongside them in memory only. So a refresh, a
 * back gesture, or the app switch a customer makes to copy an account number
 * into their banking app dropped them back to step one — at exactly the moment
 * they leave the page.
 *
 * Two mechanisms, one job:
 *
 *   - the step lives in `?step=`, so a reload and the browser's own history
 *     land where the customer was;
 *   - the attempt lives in sessionStorage, so the payment screen comes back
 *     with the same order number, the same total, the same details, and — the
 *     part that is correctness rather than convenience — the same idempotency
 *     key, which is what the order number is reserved against.
 *
 * The URL decides *whether* to resume. A `/checkout` with no step is a fresh
 * arrival (that is what the cart and the cart drawer link to) and drops any
 * leftover draft; `/checkout?step=…` is a return to one in progress. That is
 * what stops a finished order's confirmation reappearing over the next basket.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CHECKOUT_DRAFT_KEY,
  parseCheckoutDraft,
  parseCheckoutStep,
  serializeCheckoutDraft,
  type CheckoutDraft,
  type CheckoutDraftDetails,
  type CheckoutStep,
} from '@/lib/commerce/checkout-draft';

/** Never throws: Safari in private mode denies sessionStorage outright, and a
 *  storage failure must not take the checkout down with it. */
function readDraft(): CheckoutDraft | null {
  try {
    return parseCheckoutDraft(window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY));
  } catch (error) {
    console.error('Could not read the checkout draft:', error);
    return null;
  }
}

function writeDraft(draft: CheckoutDraft | null): void {
  try {
    if (draft) {
      window.sessionStorage.setItem(CHECKOUT_DRAFT_KEY, serializeCheckoutDraft(draft));
    } else {
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
    }
  } catch (error) {
    console.error('Could not persist the checkout draft:', error);
  }
}

/** The pending order: issued by the server, held here, persisted by this hook. */
interface PendingOrder {
  orderNumber: string;
  orderTotal: number;
  idempotencyKey: string;
}

export interface CheckoutAttempt extends PendingOrder {
  /** Where the customer is. */
  step: CheckoutStep;
  /** Moves them, and the URL with them. */
  setStep: (step: CheckoutStep) => void;
  /**
   * What they had already typed, when this page resumed an attempt — read once
   * so the form and shipping hooks can seed themselves from it. Null on a
   * fresh checkout.
   */
  restored: CheckoutDraft | null;
  /** The quote came back: adopt the server's number and total, show payment. */
  beginPayment: (orderNumber: string, orderTotal: number) => void;
  /** The order exists: show the confirmation, and mint a key for the next one. */
  completeOrder: () => void;
  /** Keeps the stored draft current for as long as an order is pending. */
  persist: (details: CheckoutDraftDetails) => void;
}

export function useCheckoutAttempt(): CheckoutAttempt {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlStep = parseCheckoutStep(searchParams.get('step'));

  // Read once, on the first client render. A fresh arrival — no step in the
  // URL — starts clean and takes the stale draft with it.
  const [restored] = useState<CheckoutDraft | null>(() => {
    if (typeof window === 'undefined') return null;
    if (!urlStep) {
      writeDraft(null);
      return null;
    }
    return readDraft();
  });

  /**
   * The idempotency key is one value per attempt, sent with both the quote and
   * the order. It is what makes order creation idempotent: the flow uploads a
   * receipt and then inserts, so a response lost after a successful insert
   * used to leave the customer retrying into a second order against one
   * payment.
   *
   * Restored before it is minted, because the order number is reserved against
   * it — a fresh key after a refresh would issue a second number and leave the
   * transfer remark the customer already copied pointing at nothing.
   *
   * The lazy initialiser matters: a plain `useState(crypto.randomUUID())`
   * would generate a fresh value on every render.
   */
  const [pending, setPending] = useState<PendingOrder>(() => ({
    orderNumber: restored?.orderNumber ?? '',
    orderTotal: restored?.orderTotal ?? 0,
    idempotencyKey: restored?.idempotencyKey ?? crypto.randomUUID(),
  }));

  // A `?step=payment` with no order behind it would render a payment screen
  // with no number and nothing to transfer. Step one is the honest answer.
  // Checked against the live order rather than the restored draft, so moving
  // forward within a session is not mistaken for an unrestorable URL.
  const hasOrder = Boolean(pending.orderNumber && pending.orderTotal);
  const step: CheckoutStep = !urlStep || (urlStep !== 'form' && !hasOrder) ? 'form' : urlStep;

  const setStep = useCallback(
    (next: CheckoutStep) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('step', next);
      // replace, not push: the step is where you are, not somewhere you
      // visited, so Back leaves checkout rather than walking the steps
      // backwards one at a time.
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Corrects a URL that claimed a step we cannot show, so reloading that same
  // address does not try again. Once only, and never over a real transition.
  const corrected = useRef(false);
  useEffect(() => {
    if (corrected.current || hasOrder) return;
    if (urlStep && urlStep !== step) {
      corrected.current = true;
      setStep(step);
    }
  }, [urlStep, step, hasOrder, setStep]);

  const beginPayment = useCallback(
    (orderNumber: string, orderTotal: number) => {
      setPending((previous) => ({ ...previous, orderNumber, orderTotal }));
      setStep('payment');
    },
    [setStep]
  );

  const completeOrder = useCallback(() => {
    setStep('confirmation');
    // A second order in this session is a new attempt and needs its own key,
    // or it would replay straight back into this one. The number and total
    // stay, because the confirmation screen shows them.
    setPending((previous) => ({ ...previous, idempotencyKey: crypto.randomUUID() }));
  }, [setStep]);

  const persist = useCallback(
    (details: CheckoutDraftDetails) => {
      if (!pending.orderNumber || !pending.orderTotal) return;
      writeDraft({ ...pending, ...details });
    },
    [pending]
  );

  return { ...pending, step, setStep, restored, beginPayment, completeOrder, persist };
}
