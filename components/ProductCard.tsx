// components/ProductCard.tsx - Server Component version
import Link from 'next/link';
import { ProductCardProduct } from '@/types/product';

interface ProductCardProps {
  product: ProductCardProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
  // Use defaults for missing fields
  const isOutOfStock = (product.stock || 0) <= 0;
  // Use a fallback image without onError handler
  const imageUrl = product.main_image || product.image || '/placeholder.jpg';
  const description = product.description || '';
  const category = product.category || '';
  const stock = product.stock || 0;

  return (
    <Link href={`/products/${product.id}`} className="group">
      <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:scale-[1.02] hover:shadow-xl relative">
        
        {isOutOfStock && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-bold z-10">
            SOLD OUT
          </div>
        )}
        
        {stock < 10 && stock > 0 && (
          <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-md text-xs font-bold z-10">
            LOW STOCK: {stock}
          </div>
        )}

        <div className="relative h-64 w-full overflow-hidden">
          {/* Remove onError handler for server component */}
          <img
            src={imageUrl}
            alt={product.name}
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
              isOutOfStock ? 'opacity-70' : ''
            }`}
          />
          <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-md text-sm font-semibold text-black">
            ₦{product.price.toLocaleString()}
          </div>
        </div>
        
        <div className="p-4">
          <h3 className="font-semibold text-lg mb-1 text-black">{product.name}</h3>
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 capitalize">
              {category}
            </span>
            <span className="text-sm font-medium text-blue-600">
              View Details →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}