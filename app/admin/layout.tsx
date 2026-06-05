// app/admin/layout.tsx - RESPONSIVE VERSION
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { MarqueeAlertBar } from './components/marquee-alert-bar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Just check auth, don't redirect
    const checkAuth = async () => {
      setLoading(false); // Let middleware handle redirects
    };
    
    checkAuth();
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
      {pathname !== '/admin/login' && <MarqueeAlertBar />}
      
      {/* Admin Header - Only show if not on login page */}
      {pathname !== '/admin/login' && (
        <header className="bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center justify-between w-full md:w-auto">
                {/* Logo and mobile menu button */}
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden text-gray-600 hover:text-gray-900 focus:outline-none"
                    aria-label="Toggle menu"
                  >
                    {mobileMenuOpen ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    )}
                  </button>
                  
                  <Link href="/admin/dashboard" className="text-xl font-bold text-gray-800">
                    GidiamMini Admin
                  </Link>
                </div>

                {/* Desktop Navigation - Hidden on mobile */}
                <nav className="hidden md:flex space-x-4 ml-6">
                  <Link href="/admin/dashboard" className="text-gray-600 hover:text-gray-900 px-3 py-2">
                    Dashboard
                  </Link>
                  <Link href="/admin/products" className="text-gray-600 hover:text-gray-900 px-3 py-2">
                    Products
                  </Link>
                  <Link href="/admin/orders" className="text-gray-600 hover:text-gray-900 px-3 py-2">
                    Orders
                  </Link>
                  <Link href="/admin/stock" className="text-gray-600 hover:text-gray-900 px-3 py-2">
                    Stock Management
                  </Link>
                  <Link href="/admin/categories" className="text-gray-600 hover:text-gray-900 px-3 py-2">
                    Categories
                  </Link>
                  <Link href="/admin/discounts" className="text-gray-600 hover:text-gray-900 px-3 py-2">
                    Discounts
                  </Link>
                </nav>
              </div>
              
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm whitespace-nowrap ml-4"
              >
                Logout
              </button>
            </div>

            {/* Mobile Navigation Menu */}
            {mobileMenuOpen && (
              <div className="md:hidden mt-4 pb-4 border-t pt-4">
                <nav className="flex flex-col space-y-2">
                  <Link 
                    href="/admin/dashboard" 
                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg"
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/admin/products" 
                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg"
                  >
                    Products
                  </Link>
                  <Link 
                    href="/admin/orders" 
                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg"
                  >
                    Orders
                  </Link>
                  <Link 
                    href="/admin/stock" 
                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg"
                  >
                    Stock Management
                  </Link>
                  <Link 
                    href="/admin/categories" 
                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg"
                  >
                    Categories
                  </Link>
                  <Link 
                    href="/admin/discounts" 
                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg"
                  >
                    Discounts
                  </Link>
                </nav>
              </div>
            )}
          </div>
        </header>
      )}
      
      <main className="container mx-auto px-4 sm:px-6 py-6 md:py-8">
        {pathname !== '/admin/login' && (
          <div className="md:hidden mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Desktop View Recommended</h3>
                <div className="mt-1 text-sm text-yellow-700">
                  <p>
                    For the best experience using the admin portal, please enable <strong>"Desktop site"</strong> in your browser settings (usually found by tapping the three vertical dots <span className="font-bold text-lg leading-none align-middle">⋮</span>).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}