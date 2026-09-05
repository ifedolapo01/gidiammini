/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/dashboard/page.tsx
'use client';

import Link from 'next/link';
import { Package, ShoppingBag } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNairaSign } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui';
import { useDashboardStats } from './hooks/useDashboardStats';
import { StatCard } from './components/StatCard';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import MarginStatCard from './components/MarginStatCard';
import { AnalyticsSection } from './components/AnalyticsSection';
import { RecentOrdersPanel } from './components/RecentOrdersPanel';
import { LowStockPanel } from './components/LowStockPanel';
import { WishlistDemandPanel } from './components/WishlistDemandPanel';
import { QuickActionsGrid } from './components/QuickActionsGrid';
import ExportButton from '../components/ExportButton';
import { formatCurrency } from './format-currency';

export default function AdminDashboard() {
  const { stats, loading, error, fetchDashboardStats } = useDashboardStats();

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="bg-destructive-background border border-destructive-border rounded-surface p-6">
        <h3 className="text-destructive font-semibold mb-2">Error Loading Dashboard</h3>
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="destructive" onClick={fetchDashboardStats}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-h3 font-bold text-text-primary">Admin Dashboard</h1>
          <p className="text-text-secondary mt-1">Welcome back! Here's what's happening with your store.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          {/* The customer list has no page of its own, so its export lives
              here rather than nowhere. */}
          <ExportButton dataset="customers" label="Export customers" />
          <Link
            href="/admin/products/new"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-control hover:bg-primary-hover transition-colors"
          >
            Add Product
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      {/* Five cards: 2-up on tablet, 3-up on laptop, all five in one row on a
          wide screen. Four columns would leave the fifth stranded alone on
          its own row. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6 mb-8">
        <StatCard
          title="Total Products"
          icon={<Package className="w-5 h-5 text-primary" />}
          iconBgClassName="bg-primary/10"
          value={stats.totalProducts}
          subtext={`${stats.lowStockProducts.length} low in stock`}
        />

        <StatCard
          title="Total Orders"
          icon={<ShoppingBag className="w-5 h-5 text-success" />}
          iconBgClassName="bg-success-background"
          value={stats.totalOrders}
          subtext={`${stats.pendingOrders} pending`}
        />

        <StatCard
          title="Revenue Confirmed"
          icon={<FontAwesomeIcon icon={faNairaSign} className="w-5 h-5 text-accent" />}
          iconBgClassName="bg-accent/10"
          value={formatCurrency(stats.totalRevenue)}
          subtext="All time"
        />

        <MarginStatCard margin={stats.margin} />

        <StatCard
          title="Pending Orders"
          icon={<ShoppingBag className="w-5 h-5 text-warning" />}
          iconBgClassName="bg-warning-background"
          value={stats.pendingOrders}
          valueClassName="text-warning"
          subtext="Need attention"
        />
      </div>

      {/* Analytics */}
      <AnalyticsSection />

      {/* Recent Orders & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <RecentOrdersPanel orders={stats.recentOrders} />
        <LowStockPanel products={stats.lowStockProducts} />
      </div>

      {/* Beside low stock on purpose: one says what is running out, the other
          says what people are waiting for. Together they are the restocking
          decision. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <WishlistDemandPanel />
      </div>

      {/* Quick Actions */}
      <QuickActionsGrid />
    </div>
  );
}
