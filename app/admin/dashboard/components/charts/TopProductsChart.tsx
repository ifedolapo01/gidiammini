/** ADMIN layer — top-selling products by units sold, all-time. Nominal
 * categories (product names) so every bar takes the same single hue rather
 * than a value ramp — coloring bars by their own length would double-encode
 * what the bar already shows. */
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ProductSales } from '@/lib/commerce/dashboard-analytics';
import type { SemanticChartColors } from '@/components/ui/charts/useSemanticChartColors';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';

interface TopProductsChartProps {
  data: ProductSales[];
  colors: SemanticChartColors;
}

export function TopProductsChart({ data, colors }: TopProductsChartProps) {
  const chartData = data.map((entry) => ({ label: entry.productName, quantity: entry.quantity }));

  return (
    <ChartCard title="Top-Selling Products" isEmpty={chartData.length === 0} emptyMessage="No sales yet">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 8 }}>
          <CartesianGrid horizontal={false} stroke={colors.border} />
          <XAxis
            type="number"
            tick={{ fill: colors['text-secondary'], fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: colors['text-secondary'], fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={(v) => String(v)} valueLabel="units sold" color={colors.primary} />}
            cursor={{ fill: colors.border, fillOpacity: 0.3 }}
          />
          <Bar
            dataKey="quantity"
            fill={colors.primary}
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            label={{ position: 'right', fill: colors['text-secondary'], fontSize: 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
