/**
 * ADMIN layer — a column heading that is also the sort control.
 *
 * Lifted out of CustomerTable, which was the only table that had this, so the
 * rest can have it too. It drives the server sort through useListParams — no
 * admin table sorts an array in the browser, because a browser sort would
 * reorder the current page and silently claim to have reordered the list.
 *
 * `aria-sort` lives on the <th>, which is where the spec puts it; the button
 * inside carries a label saying what pressing it will do next, since the arrow
 * alone says only what is true now.
 */
'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortDirection } from '../../hooks/useListParams';
import { TH, NUMERIC } from './table-styles';

export interface TableColumn {
  /** The server's sort key. Must match what the list endpoint accepts. */
  key: string;
  label: string;
  /** Right-aligned and tabular — money, counts, stock. */
  numeric?: boolean;
  sortable?: boolean;
  /** For a column whose heading is an icon or a checkbox. */
  srOnlyLabel?: boolean;
  className?: string;
}

interface SortableThProps {
  column: TableColumn;
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
}

export function SortableTh({ column, sort, direction, onSortChange }: SortableThProps) {
  const active = column.sortable && sort === column.key;

  const headerClass = cn(TH, column.numeric && NUMERIC, column.className);

  if (!column.sortable) {
    return (
      <th scope="col" className={headerClass}>
        {column.srOnlyLabel ? <span className="sr-only">{column.label}</span> : column.label}
      </th>
    );
  }

  // A new column starts on the answer somebody actually wants: biggest spend,
  // most orders, most recent. Only re-clicking the active column reverses it.
  const next: SortDirection = active && direction === 'desc' ? 'asc' : 'desc';

  return (
    <th
      scope="col"
      className={headerClass}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSortChange(column.key, next)}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-wider hover:text-text-primary',
          // The numeric column's heading has to sit over the digits it labels.
          column.numeric && 'flex-row-reverse',
        )}
        aria-label={`Sort by ${column.label}, ${next === 'asc' ? 'ascending' : 'descending'}`}
      >
        {column.label}
        {active ? (
          direction === 'asc' ? (
            <ArrowUp className="size-3 shrink-0" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3 shrink-0" aria-hidden="true" />
          )
        ) : (
          // A faint pair of chevrons on every sortable column, so which
          // headings are controls is visible before hovering each one.
          <ChevronsUpDown className="size-3 shrink-0 text-text-muted" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

interface SortableHeaderRowProps {
  columns: TableColumn[];
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
  /** A cell before the first column — the select-all checkbox, usually. */
  leading?: React.ReactNode;
}

/** The whole header row, for the common case of a flat column list. */
export function SortableHeaderRow({
  columns,
  sort,
  direction,
  onSortChange,
  leading,
}: SortableHeaderRowProps) {
  return (
    <tr>
      {leading}
      {columns.map((column) => (
        <SortableTh
          key={column.key}
          column={column}
          sort={sort}
          direction={direction}
          onSortChange={onSortChange}
        />
      ))}
    </tr>
  );
}
