"use client";

import { ShoppingBag, Menu, X } from "lucide-react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { useState } from "react";
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  
  // Don't render header on admin pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }
  const { getItemCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-black"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              ) : (
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              )}
            </button>
            
            <Link href="/" className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
              UrbanThreads Co.
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-4 lg:space-x-6">
            <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm lg:text-base">
              Home
            </Link>
            <Link href="/products" className="text-gray-600 hover:text-gray-900 text-sm lg:text-base">
              All Products
            </Link>
            <Link href="/products?category=men" className="text-gray-600 hover:text-gray-900 text-sm lg:text-base">
              Men
            </Link>
            <Link href="/products?category=women" className="text-gray-600 hover:text-gray-900 text-sm lg:text-base">
              Women
            </Link>
          </nav>

          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link href="/cart" className="relative">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
              {getItemCount() > 0 && (
                <span className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                  {getItemCount()}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
            <nav className="flex flex-col space-y-2 sm:space-y-3 text-black">
              <Link
                href="/"
                className="py-2 px-3 sm:px-4 hover:bg-gray-50 rounded-lg text-sm sm:text-base"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/products"
                className="py-2 px-3 sm:px-4 hover:bg-gray-50 rounded-lg text-sm sm:text-base"
                onClick={() => setMobileMenuOpen(false)}
              >
                All Products
              </Link>
              <Link
                href="/products?category=men"
                className="py-2 px-3 sm:px-4 hover:bg-gray-50 rounded-lg text-sm sm:text-base"
                onClick={() => setMobileMenuOpen(false)}
              >
                Men
              </Link>
              <Link
                href="/products?category=women"
                className="py-2 px-3 sm:px-4 hover:bg-gray-50 rounded-lg text-sm sm:text-base"
                onClick={() => setMobileMenuOpen(false)}
              >
                Women
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}