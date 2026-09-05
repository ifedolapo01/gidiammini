/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/customers/page.tsx
//
// Who buys here.
//
// The customers table and its derived stats have existed since migration
// 20251101002500; what did not exist was anywhere to look at them. Until this
// page, answering "has this person ordered before" meant searching orders by
// name and hoping they had typed it the same way both times.
//
// Sorted by lifetime spend on arrival, because "who matters here" is the
// question the page is opened with. Every other question — who has stopped
// buying, who cancels — is the same rows under a different sort, which is why
// the column headings are the controls.
'use client';

import { useState } from 'react';
import { Users, Send } from 'lucide-react';
import { Button } from '@/components/ui';
import TablePagination from '../components/TablePagination';
import ExportButton from '../components/ExportButton';
import { useToast } from '../hooks/useToast';
import { useCustomers } from './hooks/useCustomers';
import CustomerFilters from './components/CustomerFilters';
import CustomerTable from './components/CustomerTable';
import CustomerCard from './components/CustomerCard';
import SegmentCampaignDialog from './components/SegmentCampaignDialog';
import { CustomersSkeleton } from './components/CustomersSkeleton';

export default function AdminCustomers() {
  const { params, customers, meta, tags, loading, error } = useCustomers();
  const { showToast } = useToast();
  const [messagingTag, setMessagingTag] = useState<string | null>(null);

  const activeTag = params.filters.tag ?? '';

  if (loading && customers.length === 0) return <CustomersSkeleton />;

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mb-6 flex flex-col justify-between gap-4 md:mb-8 md:flex-row md:items-center">
          <div>
            <h1 className="text-h4 font-bold text-text-primary md:text-h3">Customers</h1>
            <p className="mt-1 text-text-secondary" aria-live="polite">
              {meta.total} {meta.total === 1 ? 'buyer' : 'buyers'}
              {activeTag ? ` tagged “${activeTag}”` : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Only offered once a segment is selected. "Message everybody" is
                the subscriber broadcast, which already exists elsewhere and is
                a different decision. */}
            {activeTag && (
              <Button size="sm" onClick={() => setMessagingTag(activeTag)}>
                <Send className="size-4" aria-hidden="true" />
                Message this segment
              </Button>
            )}
            <ExportButton dataset="customers" label="Export customers" />
          </div>
        </div>

        <CustomerFilters
          search={params.search}
          onSearchChange={params.setSearch}
          tags={tags}
          activeTag={activeTag}
          onTagChange={(tag) => params.setFilter('tag', tag)}
          blocked={params.filters.blocked ?? ''}
          onBlockedChange={(value) => params.setFilter('blocked', value)}
        />

        {error && (
          <div className="mb-6 rounded-control border border-destructive-border bg-destructive-background p-4">
            <p className="font-medium text-destructive">Error: {error}</p>
          </div>
        )}

        {customers.length === 0 ? (
          <div className="rounded-surface border border-border bg-surface p-8 text-center shadow-elevation-1 md:p-12">
            <Users className="mx-auto mb-4 size-16 text-text-muted" aria-hidden="true" />
            <h2 className="mb-2 text-h5 font-semibold text-text-primary">
              {params.search || activeTag ? 'Nobody matches that' : 'No customers yet'}
            </h2>
            <p className="text-text-secondary">
              {params.search || activeTag
                ? 'Try a different search, or clear the segment filter.'
                : 'A customer record is created the first time somebody orders.'}
            </p>
          </div>
        ) : (
          <div className="rounded-surface border border-border bg-surface" aria-busy={loading}>
            <CustomerTable
              customers={customers}
              sort={params.sort}
              direction={params.direction}
              onSortChange={params.setSort}
            />

            <div className="space-y-2 p-3 md:hidden">
              {customers.map((customer) => (
                <CustomerCard key={customer.customer_id} customer={customer} />
              ))}
            </div>

            <TablePagination
              page={meta.page}
              pageCount={meta.totalPages}
              total={meta.total}
              loading={loading}
              onPageChange={params.setPage}
              limit={params.limit}
              onLimitChange={params.setLimit}
              itemNoun="customers"
              label="Customer pages"
            />
          </div>
        )}
      </div>

      {messagingTag && (
        <SegmentCampaignDialog
          tag={messagingTag}
          showToast={showToast}
          onClose={() => setMessagingTag(null)}
        />
      )}
    </>
  );
}
