/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/stock/page.tsx
'use client';

import { useState, useEffect, Fragment } from 'react';
import { Package, RefreshCw, Plus, Edit, Save, X } from 'lucide-react';
import { Button, Input, Spinner } from '@/components/ui';
import { flattenProducts, FlattenedProduct } from '@/lib/commerce/product-flatten';
import { formatCurrency } from '@/lib/commerce/pricing';
import { StockBadge } from '@/components/commerce/StockBadge';

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

export default function StockManagementPage() {
  const [products, setProducts] = useState<FlattenedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FlattenedProduct | null>(null);
  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  useEffect(() => {
    loadStock();
  }, []);

  const loadStock = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/products/stock');
      if (response.ok) {
        const data = await response.json();
        setProducts(flattenProducts(data.products || []));
      }
    } catch (error) {
      console.error('Error loading stock:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshStock = () => {
    setRefreshing(true);
    loadStock();
  };

  const startEditing = (product: FlattenedProduct) => {
    setEditingProduct(product);
    setStockUpdates({
      ...stockUpdates,
      [product.id]: product.stock
    });
  };

  const saveChanges = async () => {
    if (!editingProduct) return;
    try {
      const response = await fetch(`/api/admin/products/${editingProduct.productId}/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variantKey: editingProduct.variantKey,
          stock: stockUpdates[editingProduct.id]
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert('Stock updated successfully!');
          setEditingProduct(null);
          loadStock();
        }
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Failed to update stock');
    }
  };

  const cancelEditing = () => {
    setEditingProduct(null);
  };

  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= lowStockThreshold);
  const outOfStockProducts = products.filter(p => p.stock <= 0);
  const mainProductsCount = new Set(products.map(p => p.productId)).size;

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Spinner size="xl" className="text-primary" />
            </div>
            <div className="text-body-lg text-text-secondary">Loading stock data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-h4 md:text-h3 font-bold text-text-primary">Stock Management</h1>
          <p className="text-text-secondary mt-1">
            Manage product stock quantities
          </p>
        </div>

        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="flex items-center gap-2">
            <label className="text-body-sm text-text-secondary">Low Stock Threshold:</label>
            <Input
              type="number" onFocus={(e) => e.target.select()}
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 5)}
              size="sm"
              className="w-20"
              min="1"
            />
          </div>
          <Button
            variant="outline"
            onClick={refreshStock}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 md:mb-8">
        <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
          <p className="text-body-sm text-text-secondary">Main Products</p>
          <p className="text-h4 font-bold text-primary">{mainProductsCount}</p>
        </div>
        <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
          <p className="text-body-sm text-text-secondary">Total Variations</p>
          <p className="text-h4 font-bold text-accent">{products.length}</p>
        </div>
        <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
          <p className="text-body-sm text-text-secondary">Low Stock ({lowStockThreshold} or less)</p>
          <p className="text-h4 font-bold text-warning">{lowStockProducts.length}</p>
        </div>
        <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
          <p className="text-body-sm text-text-secondary">Out of Stock</p>
          <p className="text-h4 font-bold text-destructive">{outOfStockProducts.length}</p>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-surface rounded-surface shadow-elevation-1 border border-border overflow-hidden">
        {products.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-background-tertiary text-text-muted rounded-full flex items-center justify-center mb-4">
              <Package size={32} />
            </div>
            <h3 className="text-body-lg font-bold text-text-primary mb-1">No products found</h3>
            <p className="text-text-secondary max-w-md mx-auto mb-6">
              You haven't added any products to your store yet. Add some products to start managing their stock.
            </p>
            <a
              href="/admin/products/new"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-control hover:bg-primary-hover flex items-center gap-2 font-medium transition-colors shadow-elevation-1"
            >
              <Plus size={18} />
              Add Your First Product
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-divider">
              <thead className="bg-background-secondary">
                <tr>
                  <th className="px-6 py-3 text-left pl-16 text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                    Variant
                  </th>
                  <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                    Stock Status
                  </th>
                  <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-divider">
                {(() => {
                  const groupedProducts = products.reduce((acc, product) => {
                    if (!acc[product.productId]) acc[product.productId] = [];
                    acc[product.productId].push(product);
                    return acc;
                  }, {} as Record<string, FlattenedProduct[]>);

                  return Object.entries(groupedProducts).map(([productId, variants]) => {
                    if (variants.length === 1 && variants[0].variantKey === 'single') {
                      const product = variants[0];
                      return (
                        <tr key={product.id} className="hover:bg-surface-hover">
                          <td className="px-6 py-4 whitespace-nowrap text-left pl-16">
                            <div className="flex items-center justify-start gap-4">
                              {product.main_image ? (
                                <div className="w-12 flex-shrink-0 relative rounded-control overflow-hidden">
                                  <img src={product.main_image} alt={product.name} className="block w-full h-auto" />
                                </div>
                              ) : (
                                <div className="w-12 h-12 flex-shrink-0 bg-background-tertiary rounded-control flex items-center justify-center">
                                  <Package className="h-5 w-5 text-text-secondary" />
                                </div>
                              )}
                              <div className="text-left">
                                <p className="font-bold text-text-primary">{product.name}</p>
                                <p className="text-body-sm text-text-secondary">{formatCurrency(product.price)}</p>
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
                            <span className="px-2 py-1 text-caption-md rounded-full bg-background-tertiary text-text-primary font-medium capitalize">
                              {formatCategoryStr(product.category, product.sub_category)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-left pl-16">
                            <div className="flex items-center justify-start">
                              <StockBadge
                                stock={product.stock}
                                lowStockThreshold={lowStockThreshold}
                                hideWhenInStock={false}
                                countFormat="parens"
                                className="px-3 py-1.5 font-bold"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-body-sm font-medium text-center">
                            <div className="flex justify-center">
                              <button
                                onClick={() => startEditing(product)}
                                className="text-primary hover:text-primary-hover flex items-center justify-center bg-surface px-3 py-1.5 rounded-control border border-primary/30 shadow-elevation-1 transition-all"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Update Stock
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Grouped view for products with variants
                    const parent = variants[0];
                    return (
                      <Fragment key={productId}>
                        {/* Parent Row */}
                        <tr className="bg-background-secondary border-t-2 border-border">
                          <td className="px-6 py-3 whitespace-nowrap text-left pl-16">
                            <div className="flex items-center justify-start gap-4">
                              {parent.main_image ? (
                                <div className="w-12 flex-shrink-0 relative rounded-control overflow-hidden border border-border-strong">
                                  <img src={parent.main_image} alt={parent.name} className="block w-full h-auto" />
                                </div>
                              ) : (
                                <div className="w-12 h-12 flex-shrink-0 bg-background-tertiary rounded-control flex items-center justify-center border border-border-strong">
                                  <Package className="h-5 w-5 text-text-secondary" />
                                </div>
                              )}
                              <div className="text-left">
                                <p className="font-bold text-text-primary">{parent.name}</p>
                                <p className="text-caption-md text-text-secondary">{variants.length} variations</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                          <td className="px-6 py-3 whitespace-nowrap text-center">
                            <span className="px-2 py-1 text-caption-md rounded-full bg-background-tertiary text-text-primary font-medium capitalize">
                              {formatCategoryStr(parent.category, parent.sub_category)}
                            </span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                          <td className="px-6 py-3 whitespace-nowrap text-center"></td>
                        </tr>
                        {/* Child Rows */}
                        {variants.map((product) => {
                          // Parse variant label
                          let variantDisplay = capitalizeText(product.variantLabel);
                          if (product.variantKey.includes('|')) {
                            const [size, color] = product.variantKey.split('|');
                            variantDisplay = `Size: ${size} • Color: ${capitalizeText(color)}`;
                          }

                          return (
                            <tr key={product.id} className="hover:bg-primary/10 border-l-4 border-primary/40 bg-surface">
                              <td className="px-6 py-3 whitespace-nowrap text-center">
                                {/* Empty cell for Product column indent */}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-center">
                                <div className="flex flex-col items-center justify-center">
                                  <span className="px-3 py-1 text-caption-md rounded-full bg-accent/10 text-accent font-bold border border-accent/30 mb-1">
                                    {variantDisplay}
                                  </span>
                                  <span className="text-body-sm text-text-secondary font-medium">{formatCurrency(product.price)}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-center">
                                {/* Empty Category column */}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center">
                                  <StockBadge
                                    stock={product.stock}
                                    lowStockThreshold={lowStockThreshold}
                                    hideWhenInStock={false}
                                    countFormat="parens"
                                    className="px-3 py-1.5 font-bold"
                                  />
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-center">
                                <div className="flex justify-center">
                                  <button
                                    onClick={() => startEditing(product)}
                                    className="text-primary hover:text-primary-hover flex items-center justify-center bg-surface px-3 py-1.5 rounded-control border border-primary/30 shadow-elevation-1 transition-all"
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    Update Stock
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-info-background border border-info-border rounded-surface">
        <h3 className="font-bold text-info mb-2">How Stock Management Works:</h3>
        <ul className="text-body-sm text-info space-y-1">
          <li>• <strong>Stock automatically reduces</strong> when orders are confirmed</li>
          <li>• <strong>Stock automatically restores</strong> when confirmed orders are cancelled</li>
          <li>• <strong>Products with 0 stock are hidden</strong> from customer view</li>
          <li>• Click <strong>Update Stock</strong> to modify inventory numbers. To add completely new sizes or colors, use the main Edit Product page.</li>
        </ul>
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div
          className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4"
          onMouseDown={cancelEditing}
        >
          <div
            className="bg-surface rounded-overlay shadow-elevation-4 max-w-lg w-full"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border flex justify-between items-center bg-surface z-10 rounded-t-overlay">
              <h2 className="text-h5 font-bold text-text-primary">Update Stock</h2>
              <button onClick={cancelEditing} className="text-text-secondary hover:text-text-primary">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                <div className="flex gap-4 items-start">
                  {editingProduct.main_image ? (
                    <div className="w-20 h-20 flex-shrink-0 rounded-control overflow-hidden border border-border shadow-elevation-1 bg-surface">
                      <img
                        src={editingProduct.main_image}
                        alt={editingProduct.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 flex-shrink-0 bg-background-tertiary rounded-control flex items-center justify-center border border-border shadow-elevation-1">
                      <Package className="w-10 h-10 text-text-muted" />
                    </div>
                  )}

                  <div>
                    <h3 className="text-body-lg font-bold text-text-primary">{editingProduct.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="px-2 py-1 text-caption-md rounded-full bg-accent/10 text-accent font-medium">
                        {editingProduct.variantLabel}
                      </span>
                    </div>
                    <p className="text-text-primary mt-2 font-medium">{formatCurrency(editingProduct.price)}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border-light">
                  <label className="block text-body-sm font-semibold text-text-primary mb-2">
                    New Stock Quantity
                  </label>
                  <Input
                    type="number" onFocus={(e) => e.target.select()}
                    value={stockUpdates[editingProduct.id] ?? editingProduct.stock}
                    onChange={(e) => setStockUpdates({
                      ...stockUpdates,
                      [editingProduct.id]: parseInt(e.target.value) || 0
                    })}
                    size="lg"
                    className="font-medium"
                    min="0"
                  />
                  <p className="text-caption-md text-text-secondary mt-2">
                    Current stock is {editingProduct.stock}. Updating this only affects the <strong>{editingProduct.variantLabel}</strong> variant.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border bg-background-secondary flex justify-end gap-3 rounded-b-overlay">
              <Button
                variant="outline"
                onClick={cancelEditing}
              >
                Cancel
              </Button>
              <Button onClick={saveChanges}>
                <Save className="w-4 h-4" />
                Save Stock
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
