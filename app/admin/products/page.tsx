/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/products/page.tsx - PRODUCTS LIST ONLY
'use client';

import { useState, useEffect, Fragment } from 'react';
import { Edit, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge, Button, Modal, Spinner } from '@/components/ui';
import { flattenProducts } from '@/lib/commerce/product-flatten';
import { formatCurrency } from '@/lib/commerce/pricing';
import { StockBadge } from '@/components/commerce/StockBadge';

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
  const catTitle = cat.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  if (!sub) return catTitle;
  const subClean = sub.replace(/-/g, ' ');
  const subTitle = subClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  let formattedSub = subTitle;
  if (subTitle.toLowerCase().startsWith(catTitle.toLowerCase())) {
    formattedSub = subTitle.substring(catTitle.length).trim();
  }
  return formattedSub ? `${catTitle} > ${formattedSub}` : catTitle;
};

const capitalizeText = (text: string | undefined | null) => {
  if (!text) return '';
  return text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const executeDelete = async (id: string) => {
    setIsDeleting(true);
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

      window.location.reload();
    } catch (error: any) {
      console.error('Delete error:', error);
      alert('Error deleting product: ' + error.message);
      setIsDeleting(false);
      setDeletingProduct(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-h4 font-bold text-text-primary">Manage Products</h1>
          <p className="text-text-secondary">View and manage all your products</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-control font-semibold hover:bg-primary-hover transition-colors"
        >
          <Plus size={20} />
          Add New Product
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive-background border border-destructive-border rounded-control">
          <p className="text-destructive font-medium">Error: {error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" className="text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border-strong rounded-surface">
          <div className="w-16 h-16 bg-background-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
            </svg>
          </div>
          <h3 className="text-body-lg font-medium text-text-primary mb-2">No products yet</h3>
          <p className="text-text-secondary mb-6">Get started by adding your first product</p>
          <Link
            href="/admin/products/new"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-control font-semibold hover:bg-primary-hover transition-colors inline-block"
          >
            Add First Product
          </Link>
        </div>
      ) : (
        <div className="bg-surface rounded-surface border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-secondary">
                <tr>
                  <th className="px-6 py-3 text-left pl-16 text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Variant</th>
                  <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Images</th>
                  <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider bg-surface">
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
                        <tr key={product.id} className="hover:bg-surface-hover transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-left pl-16">
                            <div className="flex items-center justify-start">
                              <div className="w-12 flex-shrink-0">
                                <img
                                  className="w-12 h-auto rounded-control block"
                                  src={product.main_image}
                                  alt={product.name}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=No+Image';
                                  }}
                                />
                              </div>
                              <div className="ml-4 text-left">
                                <div className="text-body-sm font-bold text-text-primary">{product.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {product.variantLabel && product.variantLabel !== 'Standard' ? (
                              <span className="px-3 py-1 text-caption-md rounded-full bg-accent/10 text-accent font-bold border border-accent/30">
                                {product.variantLabel}
                              </span>
                            ) : (
                              <span className="text-text-muted text-body-sm italic">No variants</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <Badge tone="primary" className="font-semibold capitalize">
                              {formatCategoryStr(product.category, product.sub_category)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-body-sm text-text-primary text-center">
                            {formatCurrency(product.price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-body-sm text-center">
                            <StockBadge
                              stock={product.stock}
                              hideWhenInStock={false}
                              countFormat="units"
                              className="font-semibold"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-body-sm text-center">
                            <div className="flex items-center justify-center gap-1">
                              <ImageIcon size={16} className="text-text-muted" />
                              <span className="text-text-secondary">
                                {1 + (product.images?.length || 0)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-body-sm font-medium text-center">
                            <div className="flex justify-center gap-2">
                              <Link
                                href={`/admin/products/edit/${product.productId}`}
                                className="text-primary hover:text-primary-hover transition-colors p-1 hover:bg-primary/10 rounded-control"
                                title="Edit product"
                              >
                                <Edit size={18} />
                              </Link>
                              <button
                                onClick={() => setDeletingProduct(product.productId)}
                                className="text-destructive transition-colors p-1 hover:bg-destructive-background rounded-control"
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
                        <tr className="bg-background-secondary border-t-2 border-border">
                          <td className="px-6 py-3 whitespace-nowrap text-left pl-16">
                            <div className="flex items-center justify-start">
                              <div className="w-12 flex-shrink-0 border border-border-strong rounded-control overflow-hidden">
                                <img
                                  className="w-12 h-auto block"
                                  src={parent.main_image}
                                  alt={parent.name}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=No+Image';
                                  }}
                                />
                              </div>
                              <div className="ml-4 text-left">
                                <div className="text-body-sm font-bold text-text-primary">{parent.name}</div>
                                <div className="text-caption-md text-text-secondary">{variants.length} variations</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                          <td className="px-6 py-3 whitespace-nowrap text-center">
                             <Badge tone="primary" className="font-semibold">
                               {formatCategoryStr(parent.category, parent.sub_category)}
                             </Badge>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                          <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                          <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                          <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-center">
                            <div className="flex justify-center gap-2">
                              <Link
                                href={`/admin/products/edit/${parent.productId}`}
                                className="text-primary hover:text-primary-hover transition-colors p-1 hover:bg-primary/10 rounded-control"
                                title="Edit product"
                              >
                                <Edit size={18} />
                              </Link>
                              <button
                                onClick={() => setDeletingProduct(parent.productId)}
                                className="text-destructive transition-colors p-1 hover:bg-destructive-background rounded-control"
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

                            return Object.entries(sizeGroups).map((entry) => {
                              const size = entry[0];
                              const sizeVariants = entry[1] as any[];
                              if (sizeVariants.length === 1) {
                                const product = sizeVariants[0];
                                return (
                                  <tr key={product.id} className="hover:bg-primary/10 transition-colors border-l-[8px] border-primary/60 bg-surface">
                                    <td className="px-6 py-3 whitespace-nowrap pl-12 text-body-sm font-bold text-text-primary text-center">
                                      Size: {size}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-center">
                                      <Badge tone="primary" className="font-bold">
                                        Color: {capitalizeText(product.extractedColor)}
                                      </Badge>
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                                    <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-text-primary text-center">
                                      {formatCurrency(product.price)}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
                                      <StockBadge
                                        stock={product.stock}
                                        hideWhenInStock={false}
                                        countFormat="units"
                                        className="font-bold"
                                      />
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <ImageIcon size={16} className="text-text-muted" />
                                        <span className="text-text-secondary">
                                          {product.extractedColor ? (product.colorImages?.[product.extractedColor] ? 1 : 0) : (product.colorImages?.[product.variantKey] ? 1 : 0)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                                  </tr>
                                );
                              }

                              return (
                                <Fragment key={`${productId}-${size}`}>
                                  <tr className="bg-accent/5 border-l-4 border-accent/30">
                                    <td className="px-6 py-2 whitespace-nowrap pl-12 text-body-sm font-bold text-text-primary text-center">
                                      Size: {size}
                                    </td>
                                    <td colSpan={6}></td>
                                  </tr>
                                  {sizeVariants.map(product => (
                                    <tr key={product.id} className="hover:bg-primary/10 transition-colors border-l-[12px] border-primary/60 bg-surface">
                                      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                                      <td className="px-6 py-3 whitespace-nowrap pl-8 text-center">
                                        <Badge tone="primary" className="font-bold">
                                          Color: {capitalizeText(product.extractedColor)}
                                        </Badge>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                                      <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-text-primary text-center">
                                        {formatCurrency(product.price)}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
                                        <StockBadge
                                          stock={product.stock}
                                          hideWhenInStock={false}
                                          countFormat="units"
                                          className="font-bold"
                                        />
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          <ImageIcon size={16} className="text-text-muted" />
                                          <span className="text-text-secondary">
                                            {product.extractedColor ? (product.colorImages?.[product.extractedColor] ? 1 : 0) : (product.colorImages?.[product.variantKey] ? 1 : 0)}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                                    </tr>
                                  ))}
                                </Fragment>
                              );
                            });
                          }

                          // Simple variants (only sizes or only colors)
                          return variants.map((product) => (
                            <tr key={product.id} className="hover:bg-primary/10 transition-colors border-l-4 border-primary/60 bg-surface">
                              <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                              <td className="px-6 py-3 whitespace-nowrap text-center">
                                <span className="px-2 inline-flex text-caption-md leading-5 font-bold rounded-full bg-accent/10 text-accent border border-accent/30">
                                  {capitalizeText(product.variantLabel)}
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                              <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-text-primary text-center">
                                {formatCurrency(product.price)}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
                                <StockBadge
                                  stock={product.stock}
                                  hideWhenInStock={false}
                                  countFormat="units"
                                  className="font-bold"
                                />
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <ImageIcon size={16} className="text-text-muted" />
                                  <span className="text-text-secondary">
                                    {product.extractedColor ? (product.colorImages?.[product.extractedColor] ? 1 : 0) : (product.colorImages?.[product.variantKey] ? 1 : 0)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-center"></td>
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
          <div className="px-6 py-4 bg-background-secondary border-t border-border">
            <div className="flex justify-between items-center">
              <p className="text-body-sm text-text-primary">
                Showing <span className="font-medium">{flattenProducts(products).length}</span> item{flattenProducts(products).length !== 1 ? 's' : ''}
              </p>
              <p className="text-body-sm text-text-secondary">
                {flattenProducts(products).filter(p => p.stock === 0).length} out of stock
              </p>
            </div>
          </div>
        </div>
      )}

      {deletingProduct && (
        <Modal
          open
          onClose={() => setDeletingProduct(null)}
          title="Delete Product"
          size="md"
        >
          <p className="text-text-secondary mb-6">
            Are you sure you want to delete this product? This action cannot be undone and will remove all variants associated with it.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setDeletingProduct(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => executeDelete(deletingProduct)}
              loading={isDeleting}
            >
              Delete Product
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
