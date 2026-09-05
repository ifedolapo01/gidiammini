/** ADMIN layer — the filter row above the products table.
 *
 * Each control writes a query parameter the list endpoint reads. Nothing here
 * filters an array: the page only ever holds the rows the server selected.
 *
 * "Status" exists because deletion is soft. Without a way to see deactivated
 * products there is no way to bulk-reactivate them, which makes the bulk
 * deactivate action one-way.
 */
'use client';

import { Search } from 'lucide-react';
import { Input, Select } from '@/components/ui';
import type { Category } from '@/types/product';
import type { SortDirection } from '../../hooks/useListParams';

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'price:desc', label: 'Price high to low' },
  { value: 'price:asc', label: 'Price low to high' },
  { value: 'stock:asc', label: 'Lowest stock first' },
];

interface ProductsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
  categories: Category[];
}

export function ProductsFilters({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  sort,
  direction,
  onSortChange,
  categories,
}: ProductsFiltersProps) {
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
          aria-label="Search products"
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

      <Select
        value={filters.status ?? 'active'}
        onChange={(event) => onFilterChange('status', event.target.value)}
        aria-label="Filter by product status"
      >
        <option value="active">Active only</option>
        <option value="inactive">Deactivated only</option>
        <option value="all">Active and deactivated</option>
      </Select>

      <Select
        value={`${sort}:${direction}`}
        onChange={(event) => {
          const [nextSort, nextDirection] = event.target.value.split(':');
          onSortChange(nextSort, nextDirection as SortDirection);
        }}
        className="lg:col-span-1"
        aria-label="Sort products"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    </div>
  );
}
