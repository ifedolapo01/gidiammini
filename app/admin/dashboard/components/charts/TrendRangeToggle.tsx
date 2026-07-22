/** ADMIN layer — segmented range control shared by the two trend charts.
 * One filter row above the charts it scopes, per the all-time charts below
 * it staying unaffected (they're a distinct "overall" story, not "this period"). */
import { Button } from '@/components/ui';
import type { TrendRange } from '../../hooks/useDashboardCharts';

const OPTIONS: { value: TrendRange; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' }
];

interface TrendRangeToggleProps {
  value: TrendRange;
  onChange: (range: TrendRange) => void;
}

export function TrendRangeToggle({ value, onChange }: TrendRangeToggleProps) {
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label="Trend range">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? 'primary' : 'ghost'}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
