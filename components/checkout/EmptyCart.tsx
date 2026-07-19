/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
import Link from 'next/link';

export default function EmptyCart() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-h4 font-bold mb-4 text-text-primary">Your cart is empty</h1>
      <Link
        href="/products"
        className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-control font-semibold hover:bg-primary-hover"
      >
        Shop Now
      </Link>
    </div>
  );
}
