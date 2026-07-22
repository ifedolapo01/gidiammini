/** ADMIN layer — shared Recharts tooltip content, styled with semantic tokens
 * (Recharts' default tooltip is an unstyled white box, invisible in dark mode).
 * Value leads, series name follows — the reader already knows which chart
 * they're looking at, so the number is what they came for. */
interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ value?: number }>;
  valueFormatter?: (value: number) => string;
  valueLabel?: string;
  color?: string;
}

export function ChartTooltip({
  active,
  label,
  payload,
  valueFormatter = (value) => String(value),
  valueLabel,
  color
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0 || payload[0]?.value === undefined) return null;

  return (
    <div className="bg-surface border border-border rounded-control shadow-elevation-2 px-3 py-2">
      {label && <p className="text-caption-md text-text-secondary mb-1">{label}</p>}
      <div className="flex items-center gap-2">
        {color && <span className="w-2.5 h-0.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
        <span className="font-bold text-text-primary">{valueFormatter(payload[0].value)}</span>
        {valueLabel && <span className="text-caption-md text-text-secondary">{valueLabel}</span>}
      </div>
    </div>
  );
}
