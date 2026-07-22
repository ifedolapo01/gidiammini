/** ADMIN layer — shared chrome for every Analytics chart panel: title, optional
 * header action (e.g. the trend range toggle), and a consistent empty state
 * so a chart with no data never renders as a blank/broken plot. */
import { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';

interface ChartCardProps {
  title: string;
  action?: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

export function ChartCard({ title, action, isEmpty, emptyMessage = 'No data yet', children }: ChartCardProps) {
  return (
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-h5 font-bold text-text-primary">{title}</h3>
        {action}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary">{emptyMessage}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
