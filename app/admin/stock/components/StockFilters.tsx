/** ADMIN layer — the controls above the stock table.
 *
 * The low-stock threshold is both a display setting and a query parameter: it
 * decides what the "Low stock" filter selects and what the Low Stock card
 * counts, so the two can never disagree.
 */
'use client';

import { Search } from 'lucide-react';
import { Input, Select } from '@/components/ui';
import type { Category } from '@/types/product';
import type { SortDirection } from '../../hooks/useListParams';

const SORT_OPTIONS = [
  { value: 'stock:asc', label: 'Lowest stock first' },
  { value: 'stock:desc', label: 'Highest stock first' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'created_at:desc', label: 'Newest first' },
];

interface StockFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
  categories: Category[];
  lowStockThreshold: number;
  onLowStockThresholdChange: (value: number) => void;
}

export function StockFilters({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  sort,
  direction,
  onSortChange,
  categories,
  lowStockThreshold,
  onLowStockThresholdChange,
}: StockFiltersProps) {
  return (
    <div className="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      <div className="relative lg:col-span-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
        <Input
          type="search"
          placeholder="Search products by name…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-10"
          aria-label="Search stock"
        />
      </div>

      <Select
        value={filters.category ?? ''}
        onChange={(event) => onFilterChange('category', event.target.value)}
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.slug}>{category.name}</option>
        ))}
      </Select>

      <Select
        value={filters.stock ?? 'all'}
        onChange={(event) => onFilterChange('stock', event.target.value)}
        aria-label="Filter by stock level"
      >
        <option value="all">Any stock level</option>
        <option value="out">Out of stock</option>
        <option value="low">Low stock</option>
        <option value="in">In stock</option>
      </Select>

      <div className="flex items-center gap-2">
        <label htmlFor="low-stock-threshold" className="text-body-sm text-text-secondary whitespace-nowrap">
          Low at
        </label>
        <Input
          id="low-stock-threshold"
          type="number"
          min="1"
          className="w-20"
          value={lowStockThreshold}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onLowStockThresholdChange(parseInt(event.target.value, 10) || 5)}
        />
      </div>

      <Select
        value={`${sort}:${direction}`}
        onChange={(event) => {
          const [nextSort, nextDirection] = event.target.value.split(':');
          onSortChange(nextSort, nextDirection as SortDirection);
        }}
        className="lg:col-span-2"
        aria-label="Sort stock rows"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    </div>
  );
}
