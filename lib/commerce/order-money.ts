/**
 * COMMERCE layer — an order's money, as a list of lines anybody can render.
 *
 * The same five or six figures appear on the admin detail panel, on the
 * printed invoice, and in the amendment email, and until this existed each of
 * those decided for itself whether to show a zero tax line, what to call the
 * delivery fee, and how to describe a customer who has overpaid. Three
 * renderings of one truth is how an invoice ends up disagreeing with the
 * screen it was printed from.
 *
 * Pure and presentation-free: it returns labels and numbers, never markup, so
 * an HTML email and a React panel can both use it.
 */

export interface OrderMoney {
  items_subtotal?: number | null;
  tax_amount?: number | null;
  shipping_amount?: number | null;
  discount_amount?: number | null;
  discount_reason?: string | null;
  total_amount: number;
  amount_paid?: number | null;
  amount_refunded?: number | null;
  delivery_option?: 'pickup' | 'delivery' | string;
}

export interface MoneyLine {
  label: string;
  amount: number;
  /** 'total' is the emphasised line; 'credit' is money coming off. */
  kind: 'line' | 'credit' | 'total';
}

const n = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * The charge breakdown, ending in the total.
 *
 * Zero lines are omitted rather than shown as "₦0" — a pickup order has no
 * delivery fee and printing one invites the question "why is delivery listed
 * at zero, was I supposed to be charged?". The exception is the subtotal,
 * which anchors the table even in the impossible case where it is zero.
 */
export function orderChargeLines(order: OrderMoney): MoneyLine[] {
  const subtotal = n(order.items_subtotal);
  const tax = n(order.tax_amount);
  const shipping = n(order.shipping_amount);
  const discount = n(order.discount_amount);

  const lines: MoneyLine[] = [{ label: 'Items', amount: subtotal, kind: 'line' }];

  if (tax > 0) lines.push({ label: 'Tax', amount: tax, kind: 'line' });

  if (shipping > 0) {
    lines.push({
      label: order.delivery_option === 'pickup' ? 'Handling' : 'Delivery',
      amount: shipping,
      kind: 'line',
    });
  }

  if (discount > 0) {
    lines.push({
      label: order.discount_reason ? `Discount — ${order.discount_reason}` : 'Discount',
      amount: -discount,
      kind: 'credit',
    });
  }

  lines.push({ label: 'Total', amount: n(order.total_amount), kind: 'total' });

  return lines;
}

export interface OrderSettlement {
  /** Credited against the order, before refunds. */
  paid: number;
  refunded: number;
  /** What the shop has actually kept. */
  net: number;
  /**
   * Positive when the customer still owes; negative when they are owed.
   * Zero when the order is square — which is not the same as "paid", since an
   * unpaid order for nothing is also zero.
   */
  balance: number;
  /** True when everything asked for has arrived and not been sent back. */
  settled: boolean;
  /** True when more was received than the order came to. */
  overpaid: boolean;
}

/** Rounded to kobo, because amount_paid and amount_refunded are numeric(12,2)
 * and floating-point addition of two of them is not. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

export function orderSettlement(order: OrderMoney): OrderSettlement {
  const paid = round2(n(order.amount_paid));
  const refunded = round2(n(order.amount_refunded));
  const net = round2(paid - refunded);
  const balance = round2(n(order.total_amount) - net);

  return {
    paid,
    refunded,
    net,
    balance,
    settled: balance <= 0,
    overpaid: balance < 0,
  };
}

/** One sentence for the balance, or null when there is nothing worth saying —
 * an order nobody has paid anything towards needs no "outstanding" banner, it
 * needs the total it already shows. */
export function describeBalance(order: OrderMoney): string | null {
  const { paid, balance, overpaid } = orderSettlement(order);

  if (paid <= 0) return null;
  if (overpaid) return `Overpaid by ${Math.abs(balance).toFixed(2)} — a refund is owed.`;
  if (balance > 0) return `${balance.toFixed(2)} still outstanding.`;
  return 'Fully paid.';
}
