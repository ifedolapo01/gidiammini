/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, ShoppingBag, RefreshCw } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNairaSign } from '@fortawesome/free-solid-svg-icons';
import { Button, Spinner } from '@/components/ui';

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  recentOrders: any[];
  lowStockProducts: any[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    recentOrders: [],
    lowStockProducts: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard stats
      const response = await fetch('/api/admin/dashboard');

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard statistics');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshData = () => {
    setRefreshing(true);
    fetchDashboardStats();
  };

  // Format currency with Nigerian Naira symbol
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Spinner size="xl" className="text-primary mx-auto mb-4" />
          <div className="text-text-secondary">Loading dashboard data...</div>
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <Button variant="outline" onClick={refreshData} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link
            href="/admin/products/new"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-control hover:bg-primary-hover transition-colors"
          >
            Add Product
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-secondary">Total Products</h3>
            <div className="p-3 bg-primary/10 rounded-control">
              <Package className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-h3 font-bold text-text-primary">{stats.totalProducts}</p>
          <p className="text-body-sm text-text-secondary mt-2">
            {stats.lowStockProducts.length} low in stock
          </p>
        </div>

        <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-secondary">Total Orders</h3>
            <div className="p-3 bg-success-background rounded-control">
              <ShoppingBag className="w-5 h-5 text-success" />
            </div>
          </div>
          <p className="text-h3 font-bold text-text-primary">{stats.totalOrders}</p>
          <p className="text-body-sm text-text-secondary mt-2">
            {stats.pendingOrders} pending
          </p>
        </div>

        <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-secondary">Revenue Confirmed</h3>
            <div className="p-3 bg-accent/10 rounded-control">
              <FontAwesomeIcon
  icon={faNairaSign}
  className="w-5 h-5 text-accent"
/>
            </div>
          </div>
          <p className="text-h3 font-bold text-text-primary">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-body-sm text-text-secondary mt-2">
            All time
          </p>
        </div>

        <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-secondary">Pending Orders</h3>
            <div className="p-3 bg-warning-background rounded-control">
              <ShoppingBag className="w-5 h-5 text-warning" />
            </div>
          </div>
          <p className="text-h3 font-bold text-warning">{stats.pendingOrders}</p>
          <p className="text-body-sm text-text-secondary mt-2">
            Need attention
          </p>
        </div>
      </div>

      {/* Recent Orders & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Recent Orders */}
        <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h5 font-bold text-text-primary">Recent Orders</h2>
            <Link
              href="/admin/orders"
              className="text-primary hover:text-primary-hover text-body-sm font-medium"
            >
              View all
            </Link>
          </div>

          {stats.recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 hover:bg-surface-hover rounded-control">
                  <div>
                    <p className="font-medium text-text-primary">{order.order_number}</p>
                    <p className="text-body-sm text-text-secondary">{order.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-text-primary">{formatCurrency(order.total_amount)}</p>
                    <p className="text-caption-md text-text-secondary">{formatDate(order.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Products */}
        <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h5 font-bold text-text-primary">Low Stock</h2>
            <Link
              href="/admin/stock"
              className="text-primary hover:text-primary-hover text-body-sm font-medium"
            >
              View all
            </Link>
          </div>

          {stats.lowStockProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary">All products have sufficient stock</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center p-3 hover:bg-destructive-background rounded-control">
                  <img
                    src={product.main_image}
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded-control mr-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-text-primary">{product.name}</p>
                    <p className="text-body-sm text-text-secondary">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${product.stock <= 5 ? 'text-destructive' : 'text-warning'}`}>
                      {product.stock} left
                    </p>
                    <p className="text-caption-md text-text-secondary">Stock alert</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
        <h2 className="text-h5 font-bold mb-6 text-text-primary">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/products"
            className="p-4 bg-primary/10 border border-primary/30 rounded-surface hover:bg-primary/20 transition-colors"
          >
            <h3 className="font-semibold text-primary mb-1">Add New Product</h3>
            <p className="text-body-sm text-primary">Upload a new item to your store</p>
          </Link>

          <Link
            href="/admin/orders"
            className="p-4 bg-success-background border border-success-border rounded-surface hover:bg-success-border transition-colors"
          >
            <h3 className="font-semibold text-success mb-1">Manage Orders</h3>
            <p className="text-body-sm text-success">View and process customer orders</p>
          </Link>

          <Link
            href="/products"
            className="p-4 bg-accent/10 border border-accent/30 rounded-surface hover:bg-accent/20 transition-colors"
          >
            <h3 className="font-semibold text-accent mb-1">View Store</h3>
            <p className="text-body-sm text-accent">See how your store looks to customers</p>
          </Link>

          <Link
            href="/admin/settings"
            className="p-4 bg-background-secondary border border-border rounded-surface hover:bg-background-tertiary transition-colors"
          >
            <h3 className="font-semibold text-text-primary mb-1">Store Settings</h3>
            <p className="text-body-sm text-text-secondary">Configure store preferences</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
