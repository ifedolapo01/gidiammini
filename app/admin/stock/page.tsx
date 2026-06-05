// app/admin/stock/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Package, RefreshCw, Plus, Edit, Save, X } from 'lucide-react';

interface ProductStock {
  id: string;
  name: string;
  stock: number;
  category: string;
  colors: string[];
  sizes: string[];
  price: number;
  main_image?: string;
  images?: string[];
}

export default function StockManagementPage() {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});
  const [newColors, setNewColors] = useState<Record<string, string[]>>({});
  const [newSizes, setNewSizes] = useState<Record<string, string[]>>({});
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
        setProducts(data.products || []);
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

  const startEditing = (product: ProductStock) => {
    setEditingProduct(product.id);
    setStockUpdates({
      ...stockUpdates,
      [product.id]: product.stock
    });
    setNewColors({
      ...newColors,
      [product.id]: [...product.colors]
    });
    setNewSizes({
      ...newSizes,
      [product.id]: [...product.sizes]
    });
  };

  const saveChanges = async (productId: string) => {
    try {
      const response = await fetch(`/api/admin/products/${productId}/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stock: stockUpdates[productId],
          colors: newColors[productId],
          sizes: newSizes[productId]
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

  const addColor = (productId: string) => {
    setNewColors({
      ...newColors,
      [productId]: [...(newColors[productId] || []), '']
    });
  };

  const removeColor = (productId: string, index: number) => {
    const updatedColors = [...(newColors[productId] || [])];
    updatedColors.splice(index, 1);
    setNewColors({
      ...newColors,
      [productId]: updatedColors
    });
  };

  const updateColor = (productId: string, index: number, value: string) => {
    const updatedColors = [...(newColors[productId] || [])];
    updatedColors[index] = value;
    setNewColors({
      ...newColors,
      [productId]: updatedColors
    });
  };

  const addSize = (productId: string) => {
    setNewSizes({
      ...newSizes,
      [productId]: [...(newSizes[productId] || []), '']
    });
  };

  const removeSize = (productId: string, index: number) => {
    const updatedSizes = [...(newSizes[productId] || [])];
    updatedSizes.splice(index, 1);
    setNewSizes({
      ...newSizes,
      [productId]: updatedSizes
    });
  };

  const updateSize = (productId: string, index: number, value: string) => {
    const updatedSizes = [...(newSizes[productId] || [])];
    updatedSizes[index] = value;
    setNewSizes({
      ...newSizes,
      [productId]: updatedSizes
    });
  };

  const getStockStatus = (stock: number) => {
  if (stock <= 0) return { text: 'Out of Stock', color: 'bg-red-100 text-red-800' };
  if (stock <= lowStockThreshold) return { text: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
  return { text: 'In Stock', color: 'bg-green-100 text-green-800' };
};

// Update the filter functions:
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
            Manage product stock, colors, and sizes
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
          <p className="text-sm text-gray-600">Total Products</p>
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
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Colors
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sizes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => {
                  const status = getStockStatus(product.stock);
                  
                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {product.main_image || (product.images && product.images[0]) ? (
                            <div className="h-10 w-10 flex-shrink-0 relative rounded overflow-hidden">
                              <img src={product.main_image || (product.images && product.images[0]) || ''} alt={product.name} className="object-cover w-full h-full" />
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
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {product.colors.map((color, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                              {color}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {product.sizes.map((size, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                              {size}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => startEditing(product)}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
          <li>• <strong>Low stock items</strong> (5 or less) appear in the low stock count</li>
          <li>• Click <strong>Edit</strong> to update stock quantity, colors, and sizes</li>
        </ul>
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">Edit Product Stock</h2>
              <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              {(() => {
                const product = products.find(p => p.id === editingProduct);
                if (!product) return null;
                
                return (
                  <div className="space-y-6">
                    <div className="flex gap-6 items-start">
                      {product.main_image || (product.images && product.images[0]) ? (
                        <div className="w-64 flex-shrink-0 rounded-lg overflow-hidden border shadow-sm bg-white">
                          <img 
                            src={product.main_image || (product.images && product.images[0]) || ''} 
                            alt={product.name} 
                            className="w-full h-auto block" 
                          />
                        </div>
                      ) : (
                        <div className="w-64 h-64 flex-shrink-0 bg-white rounded-lg flex items-center justify-center border shadow-sm">
                          <Package className="w-20 h-20 text-gray-400" />
                        </div>
                      )}
                      
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                        <p className="text-gray-500 capitalize">{product.category}</p>
                        <p className="text-gray-700 mt-2 font-medium">₦{product.price.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-8">
                      {/* Stock Quantity */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                          Stock Quantity
                        </label>
                        <input
                          type="number"
                          value={stockUpdates[product.id] || product.stock}
                          onChange={(e) => setStockUpdates({
                            ...stockUpdates,
                            [product.id]: parseInt(e.target.value) || 0
                          })}
                          className="w-full md:w-1/2 border border-gray-300 rounded-lg px-4 py-2.5 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          min="0"
                        />
                      </div>
                      
                      <div className="border-t border-gray-100"></div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Colors */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-3">Colors</label>
                          <div className="space-y-3">
                            {(newColors[product.id] || []).map((color, index) => (
                              <div key={index} className="flex items-center gap-2 group">
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    value={color}
                                    onChange={(e) => updateColor(product.id, index, e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    placeholder="e.g. Black, White, Red"
                                  />
                                </div>
                                <button
                                  onClick={() => removeColor(product.id, index)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove color"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                            ))}
                            {(newColors[product.id] || []).length === 0 && (
                              <p className="text-sm text-gray-500 italic mb-3">No colors specified.</p>
                            )}
                            <button
                              onClick={() => addColor(product.id)}
                              className="w-full mt-2 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Color
                            </button>
                          </div>
                        </div>
                        
                        {/* Sizes */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-3">Sizes</label>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              {(newSizes[product.id] || []).map((size, index) => (
                                <div key={index} className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all bg-white">
                                  <input
                                    type="text"
                                    value={size}
                                    onChange={(e) => updateSize(product.id, index, e.target.value)}
                                    className="flex-1 px-3 py-2 text-sm text-black w-full outline-none"
                                    placeholder="e.g. S, M, L"
                                  />
                                  <button
                                    onClick={() => removeSize(product.id, index)}
                                    className="px-3 py-2 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 border-l border-gray-300 transition-colors"
                                    title="Remove size"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            {(newSizes[product.id] || []).length === 0 && (
                              <p className="text-sm text-gray-500 italic mb-3">No sizes specified.</p>
                            )}
                            <button
                              onClick={() => addSize(product.id)}
                              className="w-full mt-2 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Size
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={cancelEditing}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => saveChanges(editingProduct)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}