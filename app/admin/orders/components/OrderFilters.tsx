/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderFilters.tsx
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui';
import { getStatusIcon, formatOrderStatus, ORDER_STATUSES } from '@/lib/commerce/order-status';
import { Order } from '@/types/order';

const FILTER_OPTIONS = ['all', ...ORDER_STATUSES];

interface OrderFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
}

export default function OrderFilters({
  searchTerm,
  onSearchTermChange,
  filter,
  onFilterChange,
}: OrderFiltersProps) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by order number, customer name, email, or phone..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {FILTER_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => onFilterChange(status)}
              className={`px-4 py-2 rounded-control whitespace-nowrap flex items-center gap-2 transition-colors ${
                filter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface border border-border text-text-primary hover:bg-surface-hover'
              }`}
            >
              {status === 'all' ? (
                <>
                  <Filter className="w-4 h-4" />
                  All Orders
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
    </div>
  );
}
