/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
"use client";

import { ShoppingBag, Heart, Menu, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
// Static import, so the build knows the logo's dimensions and can serve it as
// AVIF/WebP at the two heights the header actually uses. It was a 206KB PNG
// decoded down to 64px on every page of the site.
import logo from "@/public/images/logo.png";
import { useCart } from "./CartProvider";
import { useWishlist } from "./WishlistProvider";
import { useState, Suspense } from "react";
import { usePathname, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/ui';
import SearchBox from '@/components/search/SearchBox';
import StorefrontNav from '@/components/header/StorefrontNav';
import type { CategoryNavItem } from '@/lib/commerce/storefront-nav';

function HeaderContent({ categories }: { categories: CategoryNavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams?.get('category');
  
  // Don't render header on admin pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }
  const { getItemCount } = useCart();
  const { ids: wishlistIds } = useWishlist();
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
    return Boolean(pathname?.startsWith(path)) && !currentCategory;
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
              <Image
                src={logo}
                alt="GidiamMini"
                // In the header of every page, above the fold on all of them.
                priority
                // Rendered at 64px tall, 96px from sm. `w-auto` alongside the
                // fixed height is what keeps Next from warning about a
                // one-dimension override — the aspect ratio still holds.
                sizes="(max-width: 640px) 160px, 240px"
                className="!h-16 sm:!h-24 !w-auto object-contain block"
              />
            </Link>
          </div>

          <StorefrontNav categories={categories} variant="desktop" isActive={isActive} />

          {/* Desktop search. Given a max width so it does not squeeze the nav
              on a laptop, and hidden on mobile where it gets its own full-width
              row below. */}
          <div className="hidden md:block flex-1 max-w-xs lg:max-w-sm mx-4">
            <SearchBox />
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2">
            <ThemeToggle />
            {/* The way back to an order history that used to require an order
                number. Deliberately beside the wishlist and cart rather than
                buried in the footer. */}
            <Link
              href="/account"
              aria-label="Your orders"
              title="Your orders"
              className="relative p-1 hover:bg-primary/10 rounded-full transition-colors"
            >
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-text-secondary" />
            </Link>

            <Link href="/wishlist" className="relative p-1 hover:bg-primary/10 rounded-full transition-colors">
              <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-text-secondary" />
              {wishlistIds.length > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 bg-primary text-primary-foreground text-caption-sm sm:text-caption-md font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-elevation-1">
                  {wishlistIds.length}
                </span>
              )}
            </Link>
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

        {/* Mobile search, always visible rather than inside the burger menu:
            for a visitor who knows what they want it is the shortest path to
            it, and burying it behind a tap loses most of that. */}
        <div className="md:hidden mt-3">
          <SearchBox />
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-primary/10">
            <StorefrontNav
              categories={categories}
              variant="mobile"
              isActive={isActive}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
        )}
      </div>
    </header>
  );
}

/** `categories` comes from the root layout, which reads them once per request. */
export default function Header({ categories }: { categories: CategoryNavItem[] }) {
  return (
    <Suspense fallback={<div className="h-[80px] bg-surface border-b border-primary/10"></div>}>
      <HeaderContent categories={categories} />
    </Suspense>
  );
}