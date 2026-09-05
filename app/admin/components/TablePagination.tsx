/** ADMIN layer — the page control under every server-paged admin list.
 *
 * Pages are 1-indexed here, matching the `?page=` the list endpoints take.
 * The page-size select is optional: the activity feed has a fixed size, the
 * tables let the operator choose.
 */
'use client';

import { Button, Select } from '@/components/ui';

const PAGE_SIZES = [25, 50, 100];

interface TablePaginationProps {
  /** 1-indexed. */
  page: number;
  pageCount: number;
  total: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
  /** Plural noun for the count, e.g. "orders". */
  itemNoun?: string;
  label?: string;
}

export default function TablePagination({
  page,
  pageCount,
  total,
  loading = false,
  onPageChange,
  limit,
  onLimitChange,
  itemNoun = 'items',
  label = 'Pages',
}: TablePaginationProps) {
  // Nothing to page through and nothing to resize — render nothing rather than
  // an empty bar.
  if (pageCount <= 1 && !onLimitChange) return null;

  return (
    <nav
      aria-label={label}
      className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-divider"
    >
      <div className="flex items-center gap-2">
        {onLimitChange && limit !== undefined && (
          <>
            <label htmlFor="table-page-size" className="text-caption-md text-text-secondary">
              Per page
            </label>
            <Select
              id="table-page-size"
              size="sm"
              className="w-20"
              value={String(limit)}
              onChange={(event) => onLimitChange(Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </Select>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>

        <span className="text-caption-md text-text-secondary whitespace-nowrap" aria-live="polite">
          Page {Math.min(page, Math.max(pageCount, 1))} of {Math.max(pageCount, 1)} · {total} {itemNoun}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount || loading}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
