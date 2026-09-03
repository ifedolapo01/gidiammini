/** ADMIN layer — the filter bar above the activity feed. */
'use client';

import { Input, Select, Button } from '@/components/ui';
import { actionLabel, entityLabel } from '@/lib/commerce/audit-format';
import type { ActivityFilters as Filters } from '../hooks/useActivityFeed';

/** Offered in the dropdowns. Kept in step with lib/api/audit.ts by hand, since
 * the values are free-form in the database — an unknown one still renders, it
 * just is not selectable here. */
const ENTITY_TYPES = [
  'product',
  'product_variant',
  'order',
  'order_change_request',
  'discount',
  'shipping_zone',
  'category',
  'subcategory',
  'customer',
  'admin_session',
];

const ACTIONS = [
  'create',
  'update',
  'delete',
  'status_change',
  'stock_change',
  'shipping_change',
  'block',
  'unblock',
  'approve',
  'reject',
  'login',
  'login_failed',
  'login_throttled',
  'logout',
];

interface ActivityFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const LABEL = 'block text-caption-md font-medium text-text-secondary mb-1';

export default function ActivityFilters({ filters, onChange }: ActivityFiltersProps) {
  const set = (field: keyof Filters) => (value: string) =>
    onChange({ ...filters, [field]: value || undefined });

  const hasAny = Object.values(filters).some(Boolean);

  return (
    <div className="bg-surface border border-border rounded-surface p-3 sm:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="filter-entity" className={LABEL}>Type</label>
          <Select
            id="filter-entity"
            value={filters.entity_type ?? ''}
            onChange={(e) => set('entity_type')(e.target.value)}
          >
            <option value="">All types</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>{entityLabel(type)}</option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="filter-action" className={LABEL}>Action</label>
          <Select
            id="filter-action"
            value={filters.action ?? ''}
            onChange={(e) => set('action')(e.target.value)}
          >
            <option value="">All actions</option>
            {ACTIONS.map((action) => (
              <option key={action} value={action}>{actionLabel(action)}</option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="filter-since" className={LABEL}>From</label>
          <Input
            id="filter-since"
            type="date"
            value={filters.since?.slice(0, 10) ?? ''}
            onChange={(e) => set('since')(e.target.value ? `${e.target.value}T00:00:00Z` : '')}
          />
        </div>

        <div>
          <label htmlFor="filter-until" className={LABEL}>To</label>
          <Input
            id="filter-until"
            type="date"
            value={filters.until?.slice(0, 10) ?? ''}
            // End of the chosen day, so picking one date includes all of it.
            onChange={(e) => set('until')(e.target.value ? `${e.target.value}T23:59:59Z` : '')}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-caption-md text-text-secondary">
          <input
            type="checkbox"
            checked={filters.include === 'all'}
            onChange={(e) => onChange({ ...filters, include: e.target.checked ? 'all' : undefined })}
            className="rounded border-border-strong text-primary focus-visible:border-focus"
          />
          Include raw requests
        </label>

        {hasAny && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onChange({})}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
