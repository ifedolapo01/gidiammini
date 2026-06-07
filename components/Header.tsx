"use client";

import { ShoppingBag, Menu, X } from "lucide-react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { useState } from "react";
import { usePathname, useSearchParams } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams?.get('category');
  
  // Don't render header on admin pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }
  const { getItemCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string, category?: string) => {
    if (category) {
      return pathname === path && currentCategory === category;
    }
    if (path === '/') {
      return pathname === '/' && !currentCategory;
    }
    if (path === '/products') {
      return pathname === '/products' && !currentCategory;
    }
    return pathname?.startsWith(path) && !currentCategory;
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-pink-100 shadow-sm">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-700"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              ) : (
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              )}
            </button>
            
            <Link href="/" className="flex items-center">
              <img 
                src="/images/logo.png" 
                alt="GidiamMini Logo" 
                className="!h-16 sm:!h-24 !w-auto object-contain block"
              />
            </Link>
          </div>

          <nav className="hidden md:flex space-x-4 lg:space-x-6">
            <Link href="/" className={`font-semibold text-sm lg:text-base transition-colors ${isActive('/') ? 'text-pink-600 border-b-2 border-pink-600 pb-1' : 'text-gray-600 hover:text-pink-600'}`}>
              Home
            </Link>
            <Link href="/products" className={`font-semibold text-sm lg:text-base transition-colors ${isActive('/products') ? 'text-pink-600 border-b-2 border-pink-600 pb-1' : 'text-gray-600 hover:text-pink-600'}`}>
              All Products
            </Link>
            <Link href="/products?category=babies" className={`font-semibold text-sm lg:text-base transition-colors ${isActive('/products', 'babies') ? 'text-pink-600 border-b-2 border-pink-600 pb-1' : 'text-gray-600 hover:text-pink-600'}`}>
              Babies
            </Link>
            <Link href="/products?category=kids" className={`font-semibold text-sm lg:text-base transition-colors ${isActive('/products', 'kids') ? 'text-pink-600 border-b-2 border-pink-600 pb-1' : 'text-gray-600 hover:text-pink-600'}`}>
              Kids & Pre-teens
            </Link>
            <Link href="/products?category=maternity" className={`font-semibold text-sm lg:text-base transition-colors ${isActive('/products', 'maternity') ? 'text-pink-600 border-b-2 border-pink-600 pb-1' : 'text-gray-600 hover:text-pink-600'}`}>
              Maternity
            </Link>
          </nav>

          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link href="/cart" className="relative p-1 hover:bg-pink-50 rounded-full transition-colors">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
              {getItemCount() > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 bg-pink-500 text-white text-[10px] sm:text-xs font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-sm">
                  {getItemCount()}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-pink-50">
            <nav className="flex flex-col space-y-2 text-black">
              <Link
                href="/"
                className={`py-2 px-3 sm:px-4 rounded-lg text-sm sm:text-base font-medium ${isActive('/') ? 'bg-pink-100 text-pink-700' : 'hover:bg-pink-50'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/products"
                className={`py-2 px-3 sm:px-4 rounded-lg text-sm sm:text-base font-medium ${isActive('/products') ? 'bg-pink-100 text-pink-700' : 'hover:bg-pink-50'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                All Products
              </Link>
              <Link
                href="/products?category=babies"
                className={`py-2 px-3 sm:px-4 rounded-lg text-sm sm:text-base font-medium ${isActive('/products', 'babies') ? 'bg-pink-100 text-pink-700' : 'hover:bg-pink-50'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Babies
              </Link>
              <Link
                href="/products?category=kids"
                className={`py-2 px-3 sm:px-4 rounded-lg text-sm sm:text-base font-medium ${isActive('/products', 'kids') ? 'bg-pink-100 text-pink-700' : 'hover:bg-pink-50'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Kids & Pre-teens
              </Link>
              <Link
                href="/products?category=maternity"
                className={`py-2 px-3 sm:px-4 rounded-lg text-sm sm:text-base font-medium ${isActive('/products', 'maternity') ? 'bg-pink-100 text-pink-700' : 'hover:bg-pink-50'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Maternity
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}