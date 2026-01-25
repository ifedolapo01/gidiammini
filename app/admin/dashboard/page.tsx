// app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, ShoppingBag, RefreshCw } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNairaSign } from '@fortawesome/free-solid-svg-icons';

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading dashboard data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchDashboardStats}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your store.</p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center gap-2 text-black px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link 
            href="/admin/products/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Product
          </Link>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-600">Total Products</h3>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.totalProducts}</p>
          <p className="text-sm text-gray-500 mt-2">
            {stats.lowStockProducts.length} low in stock
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-600">Total Orders</h3>
            <div className="p-3 bg-green-100 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.totalOrders}</p>
          <p className="text-sm text-gray-500 mt-2">
            {stats.pendingOrders} pending
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-600">Revenue Confirmed</h3>
            <div className="p-3 bg-purple-100 rounded-lg">
              <FontAwesomeIcon 
  icon={faNairaSign} 
  className="w-5 h-5"
  style={{ color: '#9810fa' }}
/>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-sm text-gray-500 mt-2">
            All time
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-600">Pending Orders</h3>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{stats.pendingOrders}</p>
          <p className="text-sm text-gray-500 mt-2">
            Need attention
          </p>
        </div>
      </div>
      
      {/* Recent Orders & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Recent Orders */}
        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Recent Orders</h2>
            <Link 
              href="/admin/orders" 
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View all
            </Link>
          </div>
          
          {stats.recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800">{order.order_number}</p>
                    <p className="text-sm text-gray-600">{order.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">{formatCurrency(order.total_amount)}</p>
                    <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Low Stock Products */}
        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Low Stock Products</h2>
            <Link 
  href="/admin/stock"
  className="p-4 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors"
>
  <h3 className="font-semibold text-orange-700 mb-1">Manage Stock</h3>
</Link>
          </div>
          
          {stats.lowStockProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">All products have sufficient stock</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center p-3 hover:bg-red-50 rounded-lg">
                  <img 
                    src={product.main_image} 
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded-lg mr-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{product.name}</p>
                    <p className="text-sm text-gray-600">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${product.stock <= 5 ? 'text-red-600' : 'text-yellow-600'}`}>
                      {product.stock} left
                    </p>
                    <p className="text-xs text-gray-500">Stock alert</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-xl shadow border">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link 
            href="/admin/products"
            className="p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <h3 className="font-semibold text-blue-700 mb-1">Add New Product</h3>
            <p className="text-sm text-blue-600">Upload a new item to your store</p>
          </Link>
          
          <Link 
            href="/admin/orders"
            className="p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
          >
            <h3 className="font-semibold text-green-700 mb-1">Manage Orders</h3>
            <p className="text-sm text-green-600">View and process customer orders</p>
          </Link>
          
          <Link 
            href="/products"
            className="p-4 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
          >
            <h3 className="font-semibold text-purple-700 mb-1">View Store</h3>
            <p className="text-sm text-purple-600">See how your store looks to customers</p>
          </Link>
          
          <Link 
            href="/admin/settings"
            className="p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <h3 className="font-semibold text-gray-700 mb-1">Store Settings</h3>
            <p className="text-sm text-gray-600">Configure store preferences</p>
          </Link>
        </div>
      </div>
    </div>
  );
}