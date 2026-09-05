/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderFilters.tsx
//
// Every control here writes into the query the server runs. The status chips
// and the search box used to filter an in-memory array of every order ever
// placed; the sort control is new, because sorting a page client-side would
// only sort the page.
import { Search, Filter, Truck } from 'lucide-react';
import { Input, Select } from '@/components/ui';
import { getStatusIcon, formatOrderStatus, ORDER_STATUSES } from '@/lib/commerce/order-status';
import { Order } from '@/types/order';
import type { SortDirection } from '../../hooks/useListParams';

const FILTER_OPTIONS = ['all', 'overdue', ...ORDER_STATUSES];

/** `sort:direction`, so one <select> drives both query parameters. */
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'created_at:asc', label: 'Oldest first' },
  { value: 'total_amount:desc', label: 'Highest value' },
  { value: 'total_amount:asc', label: 'Lowest value' },
  { value: 'customer_name:asc', label: 'Customer A–Z' },
  { value: 'updated_at:desc', label: 'Recently updated' },
];

interface OrderFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  overdueCount: number;
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
}

export default function OrderFilters({
  searchTerm,
  onSearchTermChange,
  filter,
  onFilterChange,
  overdueCount,
  sort,
  direction,
  onSortChange,
}: OrderFiltersProps) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted w-5 h-5" />
            <Input
              type="search"
              placeholder="Search by order number, customer name, email, or phone..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-10"
              aria-label="Search orders"
            />
          </div>
        </div>

        <Select
          value={`${sort}:${direction}`}
          onChange={(event) => {
            const [nextSort, nextDirection] = event.target.value.split(':');
            onSortChange(nextSort, nextDirection as SortDirection);
          }}
          className="w-full md:w-52"
          aria-label="Sort orders"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mt-4">
        {FILTER_OPTIONS.filter((status) => status !== 'overdue' || overdueCount > 0).map((status) => (
          <button
            key={status}
            onClick={() => onFilterChange(status)}
            aria-pressed={filter === status}
            className={`px-4 py-2 rounded-control whitespace-nowrap flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus ${
              filter === status
                ? status === 'overdue'
                  ? 'bg-destructive text-text-inverse'
                  : 'bg-primary text-primary-foreground'
                : status === 'overdue'
                ? 'bg-destructive-background border border-destructive-border text-destructive hover:bg-destructive-background/80'
                : 'bg-surface border border-border text-text-primary hover:bg-surface-hover'
            }`}
          >
            {status === 'all' ? (
              <>
                <Filter className="w-4 h-4" />
                All Orders
              </>
            ) : status === 'overdue' ? (
              <>
                <Truck className="w-4 h-4" />
                Overdue ({overdueCount})
              </>
            ) : (
              <>
                {getStatusIcon(status as Order['status'])}
                {formatOrderStatus(status)}
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
