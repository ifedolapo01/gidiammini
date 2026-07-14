/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
"use client";

import { ShoppingBag, Menu, X } from "lucide-react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { useState, Suspense } from "react";
import { usePathname, useSearchParams } from 'next/navigation';

function HeaderContent() {
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
    <header className="sticky top-0 z-50 bg-surface border-b border-primary/10 shadow-elevation-1">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-text-secondary"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-text-primary" />
              ) : (
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-text-primary" />
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
            <Link href="/" className={`font-semibold text-body-sm lg:text-body-md transition-colors ${isActive('/') ? 'text-primary border-b-2 border-primary pb-1' : 'text-text-secondary hover:text-primary'}`}>
              Home
            </Link>
            <Link href="/products" className={`font-semibold text-body-sm lg:text-body-md transition-colors ${isActive('/products') ? 'text-primary border-b-2 border-primary pb-1' : 'text-text-secondary hover:text-primary'}`}>
              All Products
            </Link>
            <Link href="/products?category=babies" className={`font-semibold text-body-sm lg:text-body-md transition-colors ${isActive('/products', 'babies') ? 'text-primary border-b-2 border-primary pb-1' : 'text-text-secondary hover:text-primary'}`}>
              Babies
            </Link>
            <Link href="/products?category=kids" className={`font-semibold text-body-sm lg:text-body-md transition-colors ${isActive('/products', 'kids') ? 'text-primary border-b-2 border-primary pb-1' : 'text-text-secondary hover:text-primary'}`}>
              Kids & Pre-teens
            </Link>
            <Link href="/products?category=maternity" className={`font-semibold text-body-sm lg:text-body-md transition-colors ${isActive('/products', 'maternity') ? 'text-primary border-b-2 border-primary pb-1' : 'text-text-secondary hover:text-primary'}`}>
              Maternity
            </Link>
          </nav>

          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link href="/cart" className="relative p-1 hover:bg-primary/10 rounded-full transition-colors">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-text-secondary" />
              {getItemCount() > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 bg-primary text-primary-foreground text-caption-sm sm:text-caption-md font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-elevation-1">
                  {getItemCount()}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-primary/10">
            <nav className="flex flex-col space-y-2 text-text-primary">
              <Link
                href="/"
                className={`py-2 px-3 sm:px-4 rounded-control text-body-sm sm:text-body-md font-medium ${isActive('/') ? 'bg-primary/10 text-primary' : 'hover:bg-primary/10'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/products"
                className={`py-2 px-3 sm:px-4 rounded-control text-body-sm sm:text-body-md font-medium ${isActive('/products') ? 'bg-primary/10 text-primary' : 'hover:bg-primary/10'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                All Products
              </Link>
              <Link
                href="/products?category=babies"
                className={`py-2 px-3 sm:px-4 rounded-control text-body-sm sm:text-body-md font-medium ${isActive('/products', 'babies') ? 'bg-primary/10 text-primary' : 'hover:bg-primary/10'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Babies
              </Link>
              <Link
                href="/products?category=kids"
                className={`py-2 px-3 sm:px-4 rounded-control text-body-sm sm:text-body-md font-medium ${isActive('/products', 'kids') ? 'bg-primary/10 text-primary' : 'hover:bg-primary/10'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Kids & Pre-teens
              </Link>
              <Link
                href="/products?category=maternity"
                className={`py-2 px-3 sm:px-4 rounded-control text-body-sm sm:text-body-md font-medium ${isActive('/products', 'maternity') ? 'bg-primary/10 text-primary' : 'hover:bg-primary/10'}`}
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

export default function Header() {
  return (
    <Suspense fallback={<div className="h-[80px] bg-surface border-b border-primary/10"></div>}>
      <HeaderContent />
    </Suspense>
  );
}