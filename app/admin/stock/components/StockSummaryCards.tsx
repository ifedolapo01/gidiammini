/** ADMIN layer — summary metric cards for the stock management page. */
interface StockSummaryCardsProps {
  mainProductsCount: number;
  totalVariations: number;
  lowStockCount: number;
  lowStockThreshold: number;
  outOfStockCount: number;
}

export function StockSummaryCards({
  mainProductsCount,
  totalVariations,
  lowStockCount,
  lowStockThreshold,
  outOfStockCount,
}: StockSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 md:mb-8">
      <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
        <p className="text-body-sm text-text-secondary">Main Products</p>
        <p className="text-h4 font-bold text-primary">{mainProductsCount}</p>
      </div>
      <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
        <p className="text-body-sm text-text-secondary">Total Variations</p>
        <p className="text-h4 font-bold text-accent">{totalVariations}</p>
      </div>
      <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
        <p className="text-body-sm text-text-secondary">Low Stock ({lowStockThreshold} or less)</p>
        <p className="text-h4 font-bold text-warning">{lowStockCount}</p>
      </div>
      <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
        <p className="text-body-sm text-text-secondary">Out of Stock</p>
        <p className="text-h4 font-bold text-destructive">{outOfStockCount}</p>
      </div>
    </div>
  );
}
