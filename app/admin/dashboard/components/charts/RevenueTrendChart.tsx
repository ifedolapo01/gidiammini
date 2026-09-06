/** ADMIN layer — daily revenue trend, single series so no legend box is needed
 * (the card title already names what's plotted). */
'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyPoint } from '@/lib/commerce/dashboard-analytics';
import type { SemanticChartColors } from '@/components/ui/charts/useSemanticChartColors';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';
import { formatCurrency } from '@/lib/commerce/pricing';

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(1)}k`;
  return formatCurrency(value);
}

interface RevenueTrendChartProps {
  data: DailyPoint[];
  colors: SemanticChartColors;
  action?: React.ReactNode;
}

export function RevenueTrendChart({ data, colors, action }: RevenueTrendChartProps) {
  const isEmpty = data.every((point) => point.value === 0);

  return (
    <ChartCard title="Revenue Trend" action={action} isEmpty={isEmpty} emptyMessage="No revenue in this period">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
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
            tickFormatter={formatCompactCurrency}
            width={64}
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={formatCurrency} valueLabel="Revenue" color={colors.primary} />}
            cursor={{ stroke: colors.border }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={colors.primary}
            strokeWidth={2}
            fill={colors.primary}
            fillOpacity={0.1}
            activeDot={{ r: 4, stroke: colors.surface, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
