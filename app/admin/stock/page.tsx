// app/admin/stock/page.tsx
'use client';

import { useState, useEffect, Fragment } from 'react';
import { Package, RefreshCw, Plus, Edit, Save, X } from 'lucide-react';
import { flattenProducts, FlattenedProduct } from '@/lib/product-flatten';

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

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return { text: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (stock <= lowStockThreshold) return { text: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= lowStockThreshold);
  const outOfStockProducts = products.filter(p => p.stock <= 0);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">Loading stock data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Stock Management</h1>
          <p className="text-gray-600 mt-1">
            Manage product stock quantities
          </p>
        </div>
        
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Low Stock Threshold:</label>
            <input
              type="number"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 5)}
              className="w-20 border border-gray-500 rounded-lg px-3 py-1 text-sm text-black"
              min="1"
            />
          </div>
          <button
            onClick={refreshStock}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-black bg-white border border-gray-500 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 md:mb-8">
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-600">Total Variations</p>
          <p className="text-2xl font-bold text-gray-800">{products.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-600">Low Stock ({lowStockThreshold} or less)</p>
          <p className="text-2xl font-bold text-yellow-600">{lowStockProducts.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-600">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600">{outOfStockProducts.length}</p>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        {products.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
              <Package size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No products found</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              You haven't added any products to your store yet. Add some products to start managing their stock.
            </p>
            <a 
              href="/admin/products/new" 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Plus size={18} />
              Add Your First Product
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  const groupedProducts = products.reduce((acc, product) => {
                    if (!acc[product.productId]) acc[product.productId] = [];
                    acc[product.productId].push(product);
                    return acc;
                  }, {} as Record<string, FlattenedProduct[]>);

                  return Object.entries(groupedProducts).map(([productId, variants]) => {
                    if (variants.length === 1 && variants[0].variantKey === 'single') {
                      const product = variants[0];
                      const status = getStockStatus(product.stock);
                      return (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {product.main_image ? (
                                <div className="h-10 w-10 flex-shrink-0 relative rounded overflow-hidden">
                                  <img src={product.main_image} alt={product.name} className="object-cover w-full h-full" />
                                </div>
                              ) : (
                                <div className="h-10 w-10 flex-shrink-0 bg-gray-200 rounded flex items-center justify-center">
                                  <Package className="h-5 w-5 text-gray-500" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{product.name}</p>
                                <p className="text-sm text-gray-500">₦{product.price.toLocaleString()}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm italic">
                            No variants
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 capitalize">
                              {product.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                {status.text} ({product.stock})
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => startEditing(product)}
                              className="text-blue-600 hover:text-blue-900 flex items-center"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Update Stock
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    // Grouped view for products with variants
                    const parent = variants[0];
                    return (
                      <Fragment key={productId}>
                        {/* Parent Row */}
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td className="px-6 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {parent.main_image ? (
                                <div className="h-10 w-10 flex-shrink-0 relative rounded overflow-hidden border border-gray-300">
                                  <img src={parent.main_image} alt={parent.name} className="object-cover w-full h-full" />
                                </div>
                              ) : (
                                <div className="h-10 w-10 flex-shrink-0 bg-gray-200 rounded flex items-center justify-center border border-gray-300">
                                  <Package className="h-5 w-5 text-gray-500" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-gray-900">{parent.name}</p>
                                <p className="text-xs text-gray-500">{variants.length} variations</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap"></td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-800 font-medium">
                              {formatCategoryStr(parent.category, parent.sub_category)}
                            </span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap"></td>
                          <td className="px-6 py-3 whitespace-nowrap"></td>
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
                                const status = getStockStatus(product.stock);
                                return (
                                  <tr key={product.id} className="hover:bg-blue-50 border-l-[8px] border-blue-400 bg-white">
                                    <td className="px-6 py-3 whitespace-nowrap pl-12">
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-800">Size: {size}</span>
                                        <span className="text-sm text-gray-600 font-medium">₦{product.price.toLocaleString()}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap">
                                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200">
                                        Color: {product.extractedColor}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap"></td>
                                    <td className="px-6 py-3 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${status.color.replace('bg-', 'bg-opacity-20 bg-').replace('text-', 'border-opacity-50 border-')}`}>
                                          {status.text} ({product.stock})
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                                      <button
                                        onClick={() => startEditing(product)}
                                        className="text-blue-600 hover:text-blue-900 flex items-center bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm hover:shadow transition-all"
                                      >
                                        <Edit className="w-4 h-4 mr-1" />
                                        Update Stock
                                      </button>
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
                                    <td colSpan={4}></td>
                                  </tr>
                                  {sizeVariants.map(product => {
                                    const status = getStockStatus(product.stock);
                                    return (
                                      <tr key={product.id} className="hover:bg-blue-50 border-l-[12px] border-blue-400 bg-white">
                                        <td className="px-6 py-3 whitespace-nowrap pl-20">
                                          <p className="text-sm text-gray-600 font-medium">₦{product.price.toLocaleString()}</p>
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap">
                                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200">
                                            Color: {product.extractedColor}
                                          </span>
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap"></td>
                                        <td className="px-6 py-3 whitespace-nowrap">
                                          <div className="flex items-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${status.color.replace('bg-', 'bg-opacity-20 bg-').replace('text-', 'border-opacity-50 border-')}`}>
                                              {status.text} ({product.stock})
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                                          <button
                                            onClick={() => startEditing(product)}
                                            className="text-blue-600 hover:text-blue-900 flex items-center bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm hover:shadow transition-all"
                                          >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Update Stock
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </Fragment>
                              );
                            });
                          }

                          // Simple variants (only sizes or only colors)
                          return variants.map((product) => {
                            const status = getStockStatus(product.stock);
                            return (
                              <tr key={product.id} className="hover:bg-blue-50 border-l-4 border-blue-400 bg-white">
                                <td className="px-6 py-3 whitespace-nowrap pl-16">
                                  <p className="text-sm text-gray-600 font-medium">₦{product.price.toLocaleString()}</p>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap">
                                  <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200">
                                    {product.variantLabel}
                                  </span>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap"></td>
                                <td className="px-6 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${status.color.replace('bg-', 'bg-opacity-20 bg-').replace('text-', 'border-opacity-50 border-')}`}>
                                      {status.text} ({product.stock})
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                                  <button
                                    onClick={() => startEditing(product)}
                                    className="text-blue-600 hover:text-blue-900 flex items-center bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm hover:shadow transition-all"
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    Update Stock
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
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
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-bold text-blue-900 mb-2">How Stock Management Works:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Stock automatically reduces</strong> when orders are confirmed</li>
          <li>• <strong>Stock automatically restores</strong> when confirmed orders are cancelled</li>
          <li>• <strong>Products with 0 stock are hidden</strong> from customer view</li>
          <li>• Click <strong>Update Stock</strong> to modify inventory numbers. To add completely new sizes or colors, use the main Edit Product page.</li>
        </ul>
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white z-10 rounded-t-xl">
              <h2 className="text-xl font-bold text-gray-800">Update Stock</h2>
              <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                <div className="flex gap-4 items-start">
                  {editingProduct.main_image ? (
                    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border shadow-sm bg-white">
                      <img 
                        src={editingProduct.main_image} 
                        alt={editingProduct.name} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg flex items-center justify-center border shadow-sm">
                      <Package className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{editingProduct.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 font-medium">
                        {editingProduct.variantLabel}
                      </span>
                    </div>
                    <p className="text-gray-700 mt-2 font-medium">₦{editingProduct.price.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    New Stock Quantity
                  </label>
                  <input
                    type="number"
                    value={stockUpdates[editingProduct.id] ?? editingProduct.stock}
                    onChange={(e) => setStockUpdates({
                      ...stockUpdates,
                      [editingProduct.id]: parseInt(e.target.value) || 0
                    })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg font-medium"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Current stock is {editingProduct.stock}. Updating this only affects the <strong>{editingProduct.variantLabel}</strong> variant.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={cancelEditing}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveChanges}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center font-medium shadow-sm"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}