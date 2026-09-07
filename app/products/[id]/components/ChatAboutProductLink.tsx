/** STOREFRONT layer — a wa.me deep link to the store's own WhatsApp number.
 * Absent whenever NEXT_PUBLIC_WHATSAPP_NUMBER is unset, the same
 * "unset = invisible, not broken" convention NEXT_PUBLIC_PAYSTACK_ENABLED
 * uses — a shopper should never see a chat button that goes nowhere. */
import { MessageCircle } from 'lucide-react';
import { absoluteUrl } from '@/lib/site-url';
import type { Product } from '@/types/product';

export default function ChatAboutProductLink({ product }: { product: Product }) {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!number) return null;

  // Built the same way as the product page's own canonical/OG URL
  // (app/products/[id]/page.tsx), not window.location — this renders on the
  // server, and a client-only value here would hydration-mismatch the href.
  const message = `Hi! I have a question about ${product.name}: ${absoluteUrl(`/products/${product.id}`)}`;
  const href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 text-body-sm font-medium text-success hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 rounded-control"
    >
      <MessageCircle className="size-4" aria-hidden="true" />
      Chat with us about this
    </a>
  );
}
