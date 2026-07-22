/** ADMIN layer — daily order-count trend, single series so no legend box is needed. */
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyPoint } from '@/lib/commerce/dashboard-analytics';
import type { SemanticChartColors } from '@/components/ui/charts/useSemanticChartColors';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';

interface OrdersTrendChartProps {
  data: DailyPoint[];
  colors: SemanticChartColors;
}

export function OrdersTrendChart({ data, colors }: OrdersTrendChartProps) {
  const isEmpty = data.every((point) => point.value === 0);

  return (
    <ChartCard title="Orders Trend" isEmpty={isEmpty} emptyMessage="No orders in this period">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke={colors.border} />
          <XAxis
            dataKey="label"
            tick={{ fill: colors['text-secondary'], fontSize: 12 }}
            axisLine={{ stroke: colors.border }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: colors['text-secondary'], fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={(v) => String(v)} valueLabel="orders" color={colors.accent} />}
            cursor={{ fill: colors.accent, fillOpacity: 0.08 }}
          />
          <Bar dataKey="value" fill={colors.accent} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
