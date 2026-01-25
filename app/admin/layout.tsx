// app/admin/layout.tsx - SIMPLIFIED VERSION
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Just check auth, don't redirect
    const checkAuth = async () => {
      setLoading(false); // Let middleware handle redirects
    };
    
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin Header - Only show if not on login page */}
      {pathname !== '/admin/login' && (
        <header className="bg-white border-b shadow-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <Link href="/admin/dashboard" className="text-xl font-bold text-gray-800">
                  UrbanThreads Admin
                </Link>
                <nav className="hidden md:flex space-x-4">
                  <Link href="/admin/dashboard" className="text-gray-600 hover:text-gray-900">
                    Dashboard
                  </Link>
                  <Link href="/admin/products" className="text-gray-600 hover:text-gray-900">
                    Products
                  </Link>
                  <Link href="/admin/orders" className="text-gray-600 hover:text-gray-900">
                    Orders
                  </Link>
                  <Link href="/admin/stock" className="text-gray-600 hover:text-gray-900">
                    Stock Management
                  </Link>
                </nav>
              </div>
              
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </header>
      )}
      
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}