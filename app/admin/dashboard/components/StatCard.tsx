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
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-secondary">{title}</h3>
        <div className={`p-3 ${iconBgClassName} rounded-control`}>{icon}</div>
      </div>
      <p className={`text-h3 font-bold ${valueClassName}`}>{value}</p>
      <p className="text-body-sm text-text-secondary mt-2">{subtext}</p>
    </div>
  );
}
