/**
 * ADMIN layer — the orders page's title row and its toolbar.
 *
 * Extracted when the view toggle and the density control joined the export
 * button and pushed page.tsx past the file-size limit. It is presentation and
 * layout only: every control here is driven by state the page owns.
 */
'use client';

import LiveIndicator from '../../components/LiveIndicator';
import ExportButton from '../../components/ExportButton';
import { TableDisplayMenu, type TableColumn, type TableDensity } from '../../components/table';
import OrdersViewToggle, { type OrdersView } from './OrdersViewToggle';

interface OrdersPageHeaderProps {
  total: number;
  live: boolean;
  view: OrdersView;
  onViewChange: (view: OrdersView) => void;
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  /** Column-visibility state, forwarded to the Columns menu. */
  hideableColumns: TableColumn[];
  isColumnVisible: (key: string) => boolean;
  onToggleColumn: (key: string) => void;
  onShowAllColumns: () => void;
  hiddenColumnCount: number;
}

export default function OrdersPageHeader({
  total,
  live,
  view,
  onViewChange,
  density,
  onDensityChange,
  hideableColumns,
  isColumnVisible,
  onToggleColumn,
  onShowAllColumns,
  hiddenColumnCount,
}: OrdersPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col justify-between md:mb-8 md:flex-row md:items-center">
      <div>
        <h1 className="text-h4 font-bold text-text-primary md:text-h3">Manage Orders</h1>
        <p className="mt-1 flex items-center gap-3 text-text-secondary" aria-live="polite">
          <span>{total} order{total !== 1 ? 's' : ''} found</span>
          <LiveIndicator live={live} subject="orders" />
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 md:mt-0">
        {/* Both hidden below md: the table needs width a phone has not got, so
            a narrow screen always gets cards and neither control would have
            anything to switch. */}
        <OrdersViewToggle view={view} onChange={onViewChange} className="hidden md:inline-flex" />
        {/* Only means anything in the table view — there are no columns to
            hide and no row height to set on a grid of cards. */}
        {view === 'table' && (
          <TableDisplayMenu
            density={density}
            onDensityChange={onDensityChange}
            columns={hideableColumns}
            isColumnVisible={isColumnVisible}
            onToggleColumn={onToggleColumn}
            onShowAllColumns={onShowAllColumns}
            hiddenCount={hiddenColumnCount}
            className="hidden md:inline-flex"
          />
        )}
        {/* Line items flattened, one row each — the shape an accountant can
            pivot. */}
        <ExportButton dataset="orders" label="Export orders" />
      </div>
    </div>
  );
}
