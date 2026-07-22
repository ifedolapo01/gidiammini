/** ADMIN layer — dashboard Analytics: a recent-trend row (revenue + orders,
 * scoped by the range toggle) and an all-time row (status breakdown + top
 * products), each chart holding its previous render at reduced opacity while
 * a new range refetches instead of flashing a skeleton. */
'use client';

import { Spinner } from '@/components/ui';
import { useDashboardCharts } from '../hooks/useDashboardCharts';
import { useSemanticChartColors } from '@/components/ui/charts/useSemanticChartColors';
import { RevenueTrendChart } from './charts/RevenueTrendChart';
import { OrdersTrendChart } from './charts/OrdersTrendChart';
import { OrderStatusBreakdownChart } from './charts/OrderStatusBreakdownChart';
import { TopProductsChart } from './charts/TopProductsChart';
import { TrendRangeToggle } from './charts/TrendRangeToggle';

export function AnalyticsSection() {
  const { charts, range, setRange, loading, refreshing, error } = useDashboardCharts();
  const colors = useSemanticChartColors();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 mb-8">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive-background border border-destructive-border rounded-surface p-6 mb-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className={`mb-8 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-h5 font-bold text-text-primary">Trends</h2>
        <TrendRangeToggle value={range} onChange={setRange} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RevenueTrendChart data={charts.revenueTrend} colors={colors} />
        <OrdersTrendChart data={charts.orderTrend} colors={colors} />
      </div>

      <h2 className="text-h5 font-bold text-text-primary mb-4">All-Time Overview</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrderStatusBreakdownChart data={charts.statusBreakdown} colors={colors} />
        <TopProductsChart data={charts.topProducts} colors={colors} />
      </div>
    </div>
  );
}
