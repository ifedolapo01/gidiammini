/** STOREFRONT layer — a plain wa.me deep link, no WhatsApp Business API
 * credentials required. A customer sharing "here's where my order is at" with
 * a partner or a friend covering for them is the single most common reason
 * this page gets forwarded at all; a share link earns its keep with zero
 * backend dependency. */
'use client';

import { MessageCircle } from 'lucide-react';
import { formatCustomerStatusLabel } from '@/lib/commerce/order-status';
import type { Order } from '@/types/order';

export default function ShareOnWhatsAppLink({ order }: { order: Order }) {
  const lines = [
    `Order #${order.order_number}`,
    `Status: ${formatCustomerStatusLabel(order.status)}`,
  ];
  if (order.tracking_url) {
    lines.push(`Track: ${order.tracking_url}`);
  }

  const href = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 text-body-sm font-medium text-success hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 rounded-control"
    >
      <MessageCircle className="size-4" aria-hidden="true" />
      Share on WhatsApp
    </a>
  );
}
