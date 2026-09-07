/**
 * ADMIN layer — the one "Display" control above a table.
 *
 * Row density and column visibility in a single labelled menu. They were two
 * separate icon-pair toggles sitting next to each other, and on the orders page
 * next to a third for cards-vs-table — three near-identical pairs of small grey
 * icons, none of which said what it did. An operator could not tell which pair
 * was which without pressing one.
 *
 * So: one button that says "Display", and inside it the two things that change
 * how this table looks. The cards-vs-table choice on the orders page stays a
 * separate control, because that one changes what the page *is* rather than how
 * the table is drawn — and it is now the only icon pair in the row.
 *
 * Placement and dismissal come from useRowMenuPlacement, the same hook the row
 * actions menu uses.
 */
'use client';

import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRowMenuPlacement } from '../../hooks/useRowMenuPlacement';
import type { TableColumn } from './SortableTh';
import type { TableDensity } from './table-styles';
import { SectionHeading, CheckRow } from './menu-rows';

const MIN_WIDTH = 208;
const MAX_WIDTH = 288;

/** Two section headings and the "Show all" row, on top of the items. */
const PLACEMENT = { itemHeight: 34, chrome: 120, gap: 6 };

const DENSITIES: Array<{ value: TableDensity; label: string }> = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

interface TableDisplayMenuProps {
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  /** Only the columns this table permits hiding — see useColumnVisibility. */
  columns: TableColumn[];
  isColumnVisible: (key: string) => boolean;
  onToggleColumn: (key: string) => void;
  onShowAllColumns: () => void;
  hiddenCount: number;
  className?: string;
}

export default function TableDisplayMenu({
  density,
  onDensityChange,
  columns,
  isColumnVisible,
  onToggleColumn,
  onShowAllColumns,
  hiddenCount,
  className,
}: TableDisplayMenuProps) {
  const { open, placement, triggerRef, panelRef, toggle, onPanelKeyDown } = useRowMenuPlacement(
    columns.length + DENSITIES.length + 1,
    PLACEMENT,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex h-11 items-center gap-1.5 rounded-control border border-border-strong px-3',
          'text-body-sm font-medium text-text-primary transition-colors',
          'hover:bg-surface-hover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
          open && 'bg-surface-hover',
          className,
        )}
      >
        <SlidersHorizontal className="size-4 text-text-secondary" aria-hidden="true" />
        Display
        {/* The count, because a hidden column is invisible by definition —
            there is otherwise nothing on screen to say a figure is missing
            rather than absent. */}
        {hiddenCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-caption-md font-semibold tabular-nums text-primary-foreground">
            {hiddenCount}
          </span>
        )}
        <span className="sr-only">
          {hiddenCount > 0 ? `, ${hiddenCount} columns hidden` : ', all columns shown'}
        </span>
      </button>

      {open && placement && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Table display"
          onKeyDown={onPanelKeyDown}
          style={{
            top: placement.top,
            right: placement.right,
            width: 'max-content',
            minWidth: MIN_WIDTH,
            maxWidth: MAX_WIDTH,
            transformOrigin: placement.above ? 'bottom right' : 'top right',
          }}
          className="animate-menuIn fixed z-50 rounded-overlay border border-border bg-surface p-1 shadow-elevation-4"
        >
          <SectionHeading>Row height</SectionHeading>
          {DENSITIES.map((option) => (
            <CheckRow
              key={option.value}
              role="menuitemradio"
              checked={density === option.value}
              label={option.label}
              onClick={() => onDensityChange(option.value)}
            />
          ))}

          <div className="my-1 border-t border-border-light" />

          <SectionHeading>Columns</SectionHeading>
          {/* The menu stays open as these are pressed: hiding three columns is
              one decision, not three. */}
          {columns.map((column) => (
            <CheckRow
              key={column.key}
              role="menuitemcheckbox"
              checked={isColumnVisible(column.key)}
              label={column.label}
              onClick={() => onToggleColumn(column.key)}
            />
          ))}

          <button
            type="button"
            role="menuitem"
            disabled={hiddenCount === 0}
            onClick={onShowAllColumns}
            className={cn(
              'mt-0.5 w-full rounded-control py-1.5 pl-9 pr-3 text-left text-body-sm font-medium',
              'text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary',
              'focus-visible:bg-surface-hover focus-visible:outline-none',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            Show all columns
          </button>
        </div>
      )}
    </>
  );
}
