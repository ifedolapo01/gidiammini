/** ADMIN layer — single stat card used across the dashboard's stats grid. */
import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  icon: ReactNode;
  iconBgClassName: string;
  value: ReactNode;
  valueClassName?: string;
  subtext: ReactNode;
}

export function StatCard({
  title,
  icon,
  iconBgClassName,
  value,
  valueClassName = 'text-text-primary',
  subtext
}: StatCardProps) {
  return (
    // Padding and type step down at the five-across breakpoint so a card like
    // "Revenue Confirmed" with a six-figure value does not wrap awkwardly.
    <div className="bg-surface p-4 xl:p-5 rounded-surface shadow-elevation-1 border border-border">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-body-sm text-text-secondary">{title}</h3>
        <div className={`p-2.5 ${iconBgClassName} rounded-control flex-shrink-0`}>{icon}</div>
      </div>
      <p className={`text-h4 xl:text-h3 font-bold break-words ${valueClassName}`}>{value}</p>
      <p className="text-caption-md text-text-secondary mt-1.5">{subtext}</p>
    </div>
  );
}
