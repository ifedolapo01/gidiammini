/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// At most one "they've probably grown out of that" card, above the order
// history — a returning customer already reading their own purchase history
// is exactly who benefits from being told the size they bought a while back
// is probably tight now.
'use client';

import { Sparkles } from 'lucide-react';
import { formatDateOnly } from '@/lib/commerce/format-date';
import { findGrowthPrompt, type GrowthPromptLine } from '@/lib/commerce/growth-prompts';
import type { AccountOrder } from '@/lib/commerce/account-query';

interface GrowthPromptCardProps {
  orders: AccountOrder[];
}

function toLines(orders: AccountOrder[]): GrowthPromptLine[] {
  return orders.flatMap((order) =>
    order.order_items.map((item) => ({
      sizing_type: item.products?.sizing_type ?? null,
      size: item.size,
      createdAt: order.created_at,
      productName: item.product_name,
    }))
  );
}

export default function GrowthPromptCard({ orders }: GrowthPromptCardProps) {
  const prompt = findGrowthPrompt(toLines(orders));
  if (!prompt) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-surface border border-border bg-surface p-4">
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="text-body-sm font-medium text-text-primary">
          {prompt.productName ? `You bought ${prompt.productName} in ` : 'You bought '}
          {prompt.boughtSize} on {formatDateOnly(prompt.boughtDate)}. They&apos;re probably closer to{' '}
          <strong>{prompt.suggestedNextSize}</strong> by now.
        </p>
        <p className="mt-1 text-caption-md text-text-secondary">
          A guide based on typical growth, not a measurement. Check against the size guide before you order.
        </p>
      </div>
    </div>
  );
}
