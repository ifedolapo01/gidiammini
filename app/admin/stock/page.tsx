// app/admin/stock/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Package, RefreshCw, Plus, Edit, Save, X } from 'lucide-react';

interface ProductStock {
  id: string;
  name: string;
  current_stock: number;
  category: string;
  colors: string[];
  sizes: string[];
  price: number;
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
      [product.id]: product.current_stock
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
    if (stock === 0) return { text: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (stock <= lowStockThreshold) return { text: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  const lowStockProducts = products.filter(p => p.current_stock <= lowStockThreshold);
  const outOfStockProducts = products.filter(p => p.current_stock === 0);

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
                const status = getStockStatus(product.current_stock);
                const isEditing = editingProduct === product.id;
                
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">₦{product.price.toLocaleString()}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 capitalize">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="number"
                          value={stockUpdates[product.id] || product.current_stock}
                          onChange={(e) => setStockUpdates({
                            ...stockUpdates,
                            [product.id]: parseInt(e.target.value) || 0
                          })}
                          className="w-24 border border-gray-300 rounded-lg px-3 py-1"
                          min="0"
                        />
                      ) : (
                        <div className="flex items-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            {status.text} ({product.current_stock})
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="space-y-1">
                          {(newColors[product.id] || []).map((color, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <input
                                type="text"
                                value={color}
                                onChange={(e) => updateColor(product.id, index, e.target.value)}
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                                placeholder="Color name"
                              />
                              <button
                                onClick={() => removeColor(product.id, index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addColor(product.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Color
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {product.colors.map((color, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                              {color}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="space-y-1">
                          {(newSizes[product.id] || []).map((size, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <input
                                type="text"
                                value={size}
                                onChange={(e) => updateSize(product.id, index, e.target.value)}
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                                placeholder="Size"
                              />
                              <button
                                onClick={() => removeSize(product.id, index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addSize(product.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Size
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {product.sizes.map((size, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                              {size}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveChanges(product.id)}
                            className="text-green-600 hover:text-green-900 flex items-center"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="text-gray-600 hover:text-gray-900 flex items-center"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(product)}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}