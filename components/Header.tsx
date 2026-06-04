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

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-4 lg:space-x-6">
            <Link href="/" className="text-gray-600 hover:text-pink-600 font-semibold text-sm lg:text-base transition-colors">
              Home
            </Link>
            <Link href="/products" className="text-gray-600 hover:text-pink-600 font-semibold text-sm lg:text-base transition-colors">
              All Products
            </Link>
            <Link href="/products?category=babies" className="text-gray-600 hover:text-pink-600 font-semibold text-sm lg:text-base transition-colors">
              Babies
            </Link>
            <Link href="/products?category=kids" className="text-gray-600 hover:text-pink-600 font-semibold text-sm lg:text-base transition-colors">
              Kids & Pre-Teens
            </Link>
            <Link href="/products?category=maternity" className="text-gray-600 hover:text-pink-600 font-semibold text-sm lg:text-base transition-colors">
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
                className="py-2 px-3 sm:px-4 hover:bg-pink-50 rounded-lg text-sm sm:text-base font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/products"
                className="py-2 px-3 sm:px-4 hover:bg-pink-50 rounded-lg text-sm sm:text-base font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                All Products
              </Link>
              <Link
                href="/products?category=babies"
                className="py-2 px-3 sm:px-4 hover:bg-pink-50 rounded-lg text-sm sm:text-base font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Babies
              </Link>
              <Link
                href="/products?category=kids"
                className="py-2 px-3 sm:px-4 hover:bg-pink-50 rounded-lg text-sm sm:text-base font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Kids & Pre-Teens
              </Link>
              <Link
                href="/products?category=maternity"
                className="py-2 px-3 sm:px-4 hover:bg-pink-50 rounded-lg text-sm sm:text-base font-medium"
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