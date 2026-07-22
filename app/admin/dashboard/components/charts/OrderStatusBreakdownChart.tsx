/** ADMIN layer — order counts by status, all-time. A horizontal bar chart
 * rather than a donut: 8 statuses is past the ~6-segment limit where a pie
 * becomes hard to read, and each bar's own category label (not hue) is what
 * carries identity — several statuses intentionally share a hue family with
 * getStatusColorToken, same as the status badges elsewhere in Admin. */
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { StatusCount } from '@/lib/commerce/dashboard-analytics';
import type { SemanticChartColors } from '@/components/ui/charts/useSemanticChartColors';
import { formatOrderStatus, getStatusColorToken } from '@/lib/commerce/order-status';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';

interface OrderStatusBreakdownChartProps {
  data: StatusCount[];
  colors: SemanticChartColors;
}

export function OrderStatusBreakdownChart({ data, colors }: OrderStatusBreakdownChartProps) {
  const isEmpty = data.every((entry) => entry.count === 0);
  const chartData = data.map((entry) => ({
    label: formatOrderStatus(entry.status),
    count: entry.count,
    color: colors[getStatusColorToken(entry.status)]
  }));

  return (
    <ChartCard title="Orders by Status" isEmpty={isEmpty} emptyMessage="No orders yet">
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
            content={<ChartTooltip valueFormatter={(v) => String(v)} valueLabel="orders" />}
            cursor={{ fill: colors.border, fillOpacity: 0.3 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: 'right', fill: colors['text-secondary'], fontSize: 12 }}>
            {chartData.map((entry) => (
              <Cell key={entry.label} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
