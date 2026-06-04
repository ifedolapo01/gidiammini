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
        {children}
      </main>
    </div>
  );
}