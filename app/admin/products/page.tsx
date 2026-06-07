// app/admin/products/page.tsx - PRODUCTS LIST ONLY
'use client';

import { useState, useEffect, Fragment } from 'react';
import { Edit, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { flattenProducts } from '@/lib/product-flatten';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  main_image: string;
  images: string[];
  colors: string[];
  sizes: string[];
  details: string[];
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const formatCategoryStr = (cat: string, sub: string | undefined | null) => {
  if (!sub) return cat;
  const subClean = sub.replace(/-/g, ' ');
  const subTitle = subClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const catTitle = cat.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  let formattedSub = subTitle;
  if (subTitle.toLowerCase().startsWith(catTitle.toLowerCase())) {
    formattedSub = subTitle.substring(catTitle.length).trim();
  }
  return formattedSub ? `${catTitle} > ${formattedSub}` : catTitle;
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchProducts();
  }, []);
  
  const fetchProducts = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/admin/products', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load products');
      }
      
      setProducts(result.products || []);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      setError(error.message || 'Failed to load products. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const deleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/admin/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete product');
      }
      
      // Remove from local state
      setProducts(products.filter(p => p.id !== id));
      alert('Product deleted successfully');
    } catch (error: any) {
      console.error('Delete error:', error);
      alert('Error deleting product: ' + error.message);
    }
  };
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manage Products</h1>
          <p className="text-gray-600">View and manage all your products</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add New Product
        </Link>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 font-medium">Error: {error}</p>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products yet</h3>
          <p className="text-gray-500 mb-6">Get started by adding your first product</p>
          <Link
            href="/admin/products/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
          >
            Add First Product
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(() => {
                  const groupedProducts = flattenProducts(products).reduce((acc, product) => {
                    if (!acc[product.productId]) acc[product.productId] = [];
                    acc[product.productId].push(product);
                    return acc;
                  }, {} as Record<string, any[]>);

                  return Object.entries(groupedProducts).map(([productId, variants]) => {
                    if (variants.length === 1 && variants[0].variantKey === 'single') {
                      const product = variants[0];
                      return (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0">
                                <img
                                  className="h-10 w-10 rounded-lg object-cover"
                                  src={product.main_image}
                                  alt={product.name}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=No+Image';
                                  }}
                                />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{product.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm italic">
                            No variants
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                              {product.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ₦{product.price.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              product.stock > 10 ? 'bg-green-100 text-green-800' : 
                              product.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-red-100 text-red-800'
                            }`}>
                              {product.stock} units
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-1">
                              <ImageIcon size={16} className="text-gray-400" />
                              <span className="text-gray-600">
                                {1 + (product.images?.length || 0)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <Link
                                href={`/admin/products/edit/${product.productId}`}
                                className="text-blue-600 hover:text-blue-900 transition-colors p-1 hover:bg-blue-50 rounded"
                                title="Edit product"
                              >
                                <Edit size={18} />
                              </Link>
                              <button
                                onClick={() => deleteProduct(product.productId)}
                                className="text-red-600 hover:text-red-900 transition-colors p-1 hover:bg-red-50 rounded"
                                title="Delete product"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Grouped view
                    const parent = variants[0];
                    return (
                      <Fragment key={productId}>
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td className="px-6 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0 border border-gray-300 rounded-lg overflow-hidden">
                                <img
                                  className="h-10 w-10 object-cover"
                                  src={parent.main_image}
                                  alt={parent.name}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=No+Image';
                                  }}
                                />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-bold text-gray-900">{parent.name}</div>
                                <div className="text-xs text-gray-500">{variants.length} variations</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap"></td>
                          <td className="px-6 py-3 whitespace-nowrap">
                             <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                               {formatCategoryStr(parent.category, parent.sub_category)}
                             </span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap"></td>
                          <td className="px-6 py-3 whitespace-nowrap"></td>
                          <td className="px-6 py-3 whitespace-nowrap"></td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <Link
                                href={`/admin/products/edit/${parent.productId}`}
                                className="text-blue-600 hover:text-blue-900 transition-colors p-1 hover:bg-blue-50 rounded"
                                title="Edit product"
                              >
                                <Edit size={18} />
                              </Link>
                              <button
                                onClick={() => deleteProduct(parent.productId)}
                                className="text-red-600 hover:text-red-900 transition-colors p-1 hover:bg-red-50 rounded"
                                title="Delete product"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Child Rows */}
                        {(() => {
                          const hasCombination = variants.some(v => v.variantKey.includes('|'));
                          
                          if (hasCombination) {
                            const sizeGroups = variants.reduce((acc, v) => {
                              const [size, color] = v.variantKey.split('|');
                              if (!acc[size]) acc[size] = [];
                              acc[size].push({ ...v, extractedSize: size, extractedColor: color });
                              return acc;
                            }, {} as Record<string, any[]>);

                            return Object.entries(sizeGroups).map(([size, sizeVariants]) => {
                              if (sizeVariants.length === 1) {
                                const product = sizeVariants[0];
                                return (
                                  <tr key={product.id} className="hover:bg-blue-50 transition-colors border-l-[8px] border-blue-400 bg-white">
                                    <td className="px-6 py-3 whitespace-nowrap pl-12 text-sm font-bold text-gray-800">
                                      Size: {size}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap">
                                      <span className="px-2 inline-flex text-xs leading-5 font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                        Color: {product.extractedColor}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap"></td>
                                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-700">
                                      ₦{product.price.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-sm">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full border ${
                                        product.stock > 10 ? 'bg-green-50 text-green-700 border-green-200' : 
                                        product.stock > 0 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                        'bg-red-50 text-red-700 border-red-200'
                                      }`}>
                                        {product.stock} units
                                      </span>
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-sm">
                                      <div className="flex items-center gap-1">
                                        <ImageIcon size={16} className="text-gray-400" />
                                        <span className="text-gray-600">
                                          {1 + (product.images?.length || 0)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                                      <div className="flex gap-2">
                                        <Link
                                          href={`/admin/products/edit/${product.productId}`}
                                          className="text-blue-600 hover:text-blue-900 transition-colors p-1 hover:bg-blue-50 rounded"
                                          title="Edit product"
                                        >
                                          <Edit size={18} />
                                        </Link>
                                        <button
                                          onClick={() => deleteProduct(product.productId)}
                                          className="text-red-600 hover:text-red-900 transition-colors p-1 hover:bg-red-50 rounded"
                                          title="Delete product"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <Fragment key={`${productId}-${size}`}>
                                  <tr className="bg-purple-50/50 border-l-4 border-purple-300">
                                    <td className="px-6 py-2 whitespace-nowrap pl-12 text-sm font-bold text-gray-800">
                                      Size: {size}
                                    </td>
                                    <td colSpan={6}></td>
                                  </tr>
                                  {sizeVariants.map(product => (
                                    <tr key={product.id} className="hover:bg-blue-50 transition-colors border-l-[12px] border-blue-400 bg-white">
                                      <td className="px-6 py-3 whitespace-nowrap"></td>
                                      <td className="px-6 py-3 whitespace-nowrap pl-8">
                                        <span className="px-2 inline-flex text-xs leading-5 font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                          Color: {product.extractedColor}
                                        </span>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap"></td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-700">
                                        ₦{product.price.toLocaleString()}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full border ${
                                          product.stock > 10 ? 'bg-green-50 text-green-700 border-green-200' : 
                                          product.stock > 0 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                          'bg-red-50 text-red-700 border-red-200'
                                        }`}>
                                          {product.stock} units
                                        </span>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm">
                                        <div className="flex items-center gap-1">
                                          <ImageIcon size={16} className="text-gray-400" />
                                          <span className="text-gray-600">
                                            {1 + (product.images?.length || 0)}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap"></td>
                                    </tr>
                                  ))}
                                </Fragment>
                              );
                            });
                          }

                          // Simple variants (only sizes or only colors)
                          return variants.map((product) => (
                            <tr key={product.id} className="hover:bg-blue-50 transition-colors border-l-4 border-blue-400 bg-white">
                              <td className="px-6 py-3 whitespace-nowrap"></td>
                              <td className="px-6 py-3 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                  {product.variantLabel}
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap"></td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-700">
                                ₦{product.price.toLocaleString()}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full border ${
                                  product.stock > 10 ? 'bg-green-50 text-green-700 border-green-200' : 
                                  product.stock > 0 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                  'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                  {product.stock} units
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-1">
                                  <ImageIcon size={16} className="text-gray-400" />
                                  <span className="text-gray-600">
                                    {1 + (product.images?.length || 0)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap"></td>
                            </tr>
                          ));
                        })()}
                      </Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{flattenProducts(products).length}</span> item{flattenProducts(products).length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-gray-500">
                {flattenProducts(products).filter(p => p.stock === 0).length} out of stock
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}