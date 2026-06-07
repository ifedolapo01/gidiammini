'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit2, Loader2, Tag, Percent, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Discount {
  id: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  scope: 'SITEWIDE' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT';
  target_id: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories: { id: string; name: string; slug: string; }[];
}

interface Product {
  id: string;
  name: string;
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    value: '',
    scope: 'SITEWIDE' as 'SITEWIDE' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT',
    target_id: '',
    is_active: true,
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch discounts
      const discRes = await fetch('/api/admin/discounts');
      const discData = await discRes.json();
      if (discData.success) setDiscounts(discData.discounts);

      // Fetch categories for the target dropdown
      const catRes = await fetch('/api/admin/categories');
      const catData = await catRes.json();
      if (catData.success) setCategories(catData.categories);

      // Fetch products for the target dropdown
      const prodRes = await fetch('/api/admin/products');
      const prodData = await prodRes.json();
      if (prodData.success) setProducts(prodData.products);

    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (discount?: Discount) => {
    if (discount) {
      setEditingId(discount.id);
      setFormData({
        name: discount.name,
        type: discount.type,
        value: discount.value.toString(),
        scope: discount.scope,
        target_id: discount.target_id || '',
        is_active: discount.is_active,
        start_date: discount.start_date ? discount.start_date.substring(0, 16) : '',
        end_date: discount.end_date ? discount.end_date.substring(0, 16) : ''
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        type: 'PERCENTAGE',
        value: '',
        scope: 'SITEWIDE',
        target_id: '',
        is_active: true,
        start_date: '',
        end_date: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const url = '/api/admin/discounts';
      const method = editingId ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        id: editingId,
        value: Number(formData.value),
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        fetchData();
        closeModal();
      } else {
        setError(data.error || 'Failed to save discount');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this discount?')) return;
    
    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to delete discount');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const toggleStatus = async (discount: Discount) => {
    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...discount, is_active: !discount.is_active })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      alert('Failed to toggle status');
    }
  };

  if (loading && discounts.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Discounts</h1>
          <p className="text-gray-500">Create rules for sales, coupons, and markdowns.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          Create Discount
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {discounts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
              <Percent size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No discounts yet</h3>
            <p className="text-gray-500 max-w-md mx-auto">Create a discount to boost your sales. You can apply discounts sitewide, by category, or to specific products.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-600 uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Name & Value</th>
                  <th className="px-6 py-4 font-semibold">Scope</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Dates</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {discounts.map((discount) => (
                  <tr key={discount.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${discount.type === 'PERCENTAGE' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                          {discount.type === 'PERCENTAGE' ? <Percent size={20} /> : <span className="font-bold">₦</span>}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{discount.name}</p>
                          <p className="text-sm text-gray-500 font-medium">
                            {discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₦${discount.value.toLocaleString()} OFF`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wider">
                        <Tag size={12} />
                        {discount.scope}
                      </span>
                      {discount.scope !== 'SITEWIDE' && (
                        <p className="text-xs text-gray-500 mt-1 max-w-[150px] truncate" title={discount.target_id || ''}>
                          Target: {discount.target_id}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleStatus(discount)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${discount.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${discount.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {(discount.start_date || discount.end_date) ? (
                        <div className="text-sm text-gray-600 space-y-1 flex flex-col justify-center">
                          {discount.start_date && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-green-400"></span>
                              {format(new Date(discount.start_date), 'MMM d, yyyy')}
                            </div>
                          )}
                          {discount.end_date && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-red-400"></span>
                              {format(new Date(discount.end_date), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 italic">No expiry</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openModal(discount)} className="text-gray-400 hover:text-blue-600 p-2 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(discount.id)} className="text-gray-400 hover:text-red-600 p-2 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discount Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Discount' : 'Create New Discount'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 p-1">
                <Trash2 size={24} className="hidden" /> {/* Spacer */}
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Discount Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="e.g. Summer Sale 2024"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Discount Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED">Fixed Amount (₦)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Value</label>
                    <div className="relative">
                      {formData.type === 'FIXED' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>}
                      <input
                        type="number" onFocus={(e) => e.target.select()}
                        value={formData.value}
                        onChange={(e) => setFormData({...formData, value: e.target.value})}
                        className={`w-full border border-gray-300 rounded-lg py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${formData.type === 'FIXED' ? 'pl-7 pr-3' : 'px-3'}`}
                        placeholder={formData.type === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 5000'}
                        min="0"
                        max={formData.type === 'PERCENTAGE' ? "100" : undefined}
                        required
                      />
                      {formData.type === 'PERCENTAGE' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Scope</label>
                    <select
                      value={formData.scope}
                      onChange={(e) => setFormData({...formData, scope: e.target.value as any, target_id: ''})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="SITEWIDE">Sitewide</option>
                      <option value="CATEGORY">Category</option>
                      <option value="SUBCATEGORY">Subcategory</option>
                      <option value="PRODUCT">Specific Product</option>
                    </select>
                  </div>
                  
                  {formData.scope !== 'SITEWIDE' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target</label>
                      {formData.scope === 'CATEGORY' && (
                        <select
                          value={formData.target_id}
                          onChange={(e) => setFormData({...formData, target_id: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          required
                        >
                          <option value="">Select a category...</option>
                          {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
                        </select>
                      )}
                      
                      {formData.scope === 'SUBCATEGORY' && (
                        <select
                          value={formData.target_id}
                          onChange={(e) => setFormData({...formData, target_id: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          required
                        >
                          <option value="">Select a subcategory...</option>
                          {categories.flatMap(c => c.subcategories || []).map(s => (
                            <option key={s.id} value={s.slug}>{s.name}</option>
                          ))}
                        </select>
                      )}

                      {formData.scope === 'PRODUCT' && (
                        <select
                          value={formData.target_id}
                          onChange={(e) => setFormData({...formData, target_id: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          required
                        >
                          <option value="">Select a product...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Date <span className="font-normal text-gray-400 text-xs">(Optional)</span></label>
                    <input
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">End Date <span className="font-normal text-gray-400 text-xs">(Optional)</span></label>
                    <input
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active (Apply this discount immediately)</label>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name || !formData.value}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {editingId ? 'Save Changes' : 'Create Discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
