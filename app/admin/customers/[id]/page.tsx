/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/customers/[id]/page.tsx
//
// One buyer, everything the shop knows about them.
//
// A page rather than a modal over the list. This is where somebody lands from
// a WhatsApp message — "it's the lady who ordered the yellow gown in March" —
// and reads for a minute before answering; a dialog over a table is the wrong
// shape for that, and it cannot be linked to or kept open in a tab.
//
// Two columns from lg: the record on the left (stats, orders, addresses,
// wishlist) and the controls on the right, so the editable fields are never
// mixed into the history somebody is reading.
'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Ban, Mail, Phone } from 'lucide-react';
import { Badge, ErrorState, Skeleton } from '@/components/ui';
import EntityHistory from '../../components/EntityHistory';
import { useToast } from '../../hooks/useToast';
import { useCustomerDetail } from '../hooks/useCustomerDetail';
import CustomerStats from './components/CustomerStats';
import CustomerOrderHistory from './components/CustomerOrderHistory';
import CustomerAddresses from './components/CustomerAddresses';
import CustomerWishlist from './components/CustomerWishlist';
import CustomerAdminPanel from './components/CustomerAdminPanel';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-body-lg font-semibold text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

export default function AdminCustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showToast } = useToast();
  const { customer, orders, addresses, wishlist, loading, error, saving, save } =
    useCustomerDetail(id, showToast);

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6 lg:p-8" aria-busy="true" aria-label="Loading customer">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <ErrorState
          title="Could not open this customer"
          description={error || 'No customer exists with that id.'}
          actions={
            <Link
              href="/admin/customers"
              className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-4 py-2 text-body-sm font-medium text-text-primary hover:bg-surface-hover"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to all customers
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All customers
      </Link>

      <header className="mb-6">
        <h1 className="text-h4 font-bold text-text-primary md:text-h3">
          {customer.full_name || customer.email}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-text-secondary">
          <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 hover:text-primary">
            <Mail className="size-4" aria-hidden="true" />
            {customer.email}
          </a>
          {(customer.phone_raw || customer.phone_e164) && (
            <a
              href={`tel:${customer.phone_e164 ?? customer.phone_raw}`}
              className="inline-flex items-center gap-1.5 hover:text-primary"
            >
              <Phone className="size-4" aria-hidden="true" />
              {customer.phone_raw ?? customer.phone_e164}
            </a>
          )}
        </div>

        {customer.is_blocked && (
          <div className="mt-3 flex items-start gap-2 rounded-surface border border-destructive-border bg-destructive-background p-3">
            <Ban className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-body-sm font-semibold text-destructive">
                This customer is blocked — their checkout is refused.
              </p>
              {customer.blocked_reason && (
                <p className="mt-0.5 text-caption-md text-text-secondary">{customer.blocked_reason}</p>
              )}
            </div>
          </div>
        )}

        {(customer.tags?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {customer.tags!.map((tag) => (
              <Badge key={tag} tone="primary">{tag}</Badge>
            ))}
          </div>
        )}
      </header>

      <div className="mb-6">
        <CustomerStats customer={customer} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Section title={`Orders (${orders.length})`}>
            <CustomerOrderHistory orders={orders} />
          </Section>

          <Section title="Addresses used">
            <CustomerAddresses addresses={addresses} />
          </Section>

          <Section title="Saved products">
            <CustomerWishlist items={wishlist} />
          </Section>

          {/* Who changed this record, and why. The same panel the order detail
              uses, reading the same audit trail. */}
          <Section title="Activity">
            <EntityHistory entityType="customer" entityId={customer.customer_id} pageSize={10} />
          </Section>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <CustomerAdminPanel customer={customer} saving={saving} onSave={save} />
        </aside>
      </div>
    </div>
  );
}
