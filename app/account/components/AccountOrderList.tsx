/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The order history, newest first.
//
// A client component only because of the reorder button. The data arrives as a
// prop from the server page, so the list itself is in the HTML — a customer on
// a slow connection sees their orders before any JavaScript runs.
//
// Statuses use the customer-facing labels, not the admin's: 'pending' here
// means "we are checking your transfer", and the admin's word for it would
// read as "you still have to pay".
'use client';

import { Package } from 'lucide-react';
import Link from 'next/link';
import type { AccountOrder } from '@/lib/commerce/account-query';
import GrowthPromptCard from './GrowthPromptCard';
import { AccountOrderRow } from './AccountOrderRow';

interface AccountOrderListProps {
  orders: AccountOrder[];
  customerEmail: string;
}

export function AccountOrderList({ orders, customerEmail }: AccountOrderListProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-surface border border-dashed border-border bg-surface p-8 text-center">
        <Package className="mx-auto h-8 w-8 text-text-muted" aria-hidden="true" />
        <p className="mt-3 text-body-md font-medium text-text-primary">No orders on this account yet</p>
        <p className="mt-1 text-body-sm text-text-secondary">
          Anything you order with this email address will appear here.
        </p>
        <Link
          href="/products"
          className="mt-4 inline-flex text-body-md font-medium text-primary underline-offset-4 hover:underline"
        >
          Browse the collection →
        </Link>
      </div>
    );
  }

  return (
    <>
      <GrowthPromptCard orders={orders} />
      <ul className="space-y-4">
        {orders.map((order) => (
          <AccountOrderRow key={order.id} order={order} customerEmail={customerEmail} />
        ))}
      </ul>
    </>
  );
}
