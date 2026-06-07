'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit2, Loader2, Tag, Percent, Calendar, Send } from 'lucide-react';
import { format } from 'date-fns';

interface Discount {
  id: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  scope: 'SITEWIDE' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT' | 'VARIANT';
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
  sizes?: string[];
  colors?: string[];
  pricing_config?: any;
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

  const [notifyModalDiscount, setNotifyModalDiscount] = useState<Discount | null>(null);
  const [notifySubject, setNotifySubject] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [isNotifying, setIsNotifying] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    value: '',
    scope: 'SITEWIDE' as 'SITEWIDE' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT' | 'VARIANT',
    target_id: '',
    is_active: true,
    start_date: '',
    end_date: ''
  });

  const [addedVariants, setAddedVariants] = useState<{productId: string, size: string, color: string}[]>([]);
  const [variantProductId, setVariantProductId] = useState('');
  const [variantSize, setVariantSize] = useState('');
  const [variantColor, setVariantColor] = useState('');

  useEffect(() => {
    if (formData.scope === 'VARIANT') {
      const targetStr = addedVariants.map(v => `${v.productId}:${v.size}:${v.color}`).join(',');
      setFormData(prev => ({...prev, target_id: targetStr}));
    }
  }, [addedVariants, formData.scope]);

  useEffect(() => {
    if (variantProductId && variantSize && variantColor) {
      const selectedProduct = products.find(p => p.id === variantProductId);
      const config = selectedProduct?.pricing_config;
      let availableColors = selectedProduct?.colors || [];
      
      if (config && config.mode === 'combination') {
        const combinationPrices = config.combinationPrices || {};
        availableColors = Object.keys(combinationPrices)
          .filter(key => key.startsWith(`${variantSize}|`))
          .map(key => key.split('|')[1]);
      }
      
      if (!availableColors.includes(variantColor) && availableColors.length > 0) {
        setVariantColor('');
      }
    }
  }, [variantProductId, variantSize, variantColor, products]);

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
        start_date: discount.start_date ? format(new Date(discount.start_date), "yyyy-MM-dd'T'HH:mm") : '',
        end_date: discount.end_date ? format(new Date(discount.end_date), "yyyy-MM-dd'T'HH:mm") : ''
      });
      if (discount.scope === 'VARIANT' && discount.target_id) {
        const variants = discount.target_id.split(',').map(v => {
          const parts = v.split(':');
          return { productId: parts[0] || '', size: parts[1] || '', color: parts[2] || '' };
        });
        setAddedVariants(variants);
      } else {
        setAddedVariants([]);
      }
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
      setAddedVariants([]);
      setVariantProductId('');
      setVariantSize('');
      setVariantColor('');
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

  const handleNotifySubmit = async () => {
    if (!notifyModalDiscount) return;
    setIsNotifying(true);
    try {
      const res = await fetch('/api/admin/discounts/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountId: notifyModalDiscount.id,
          customSubject: notifySubject,
          customMessage: notifyMessage
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setNotifyModalDiscount(null);
      } else {
        alert('Failed to send notification: ' + data.error);
      }
    } catch (err) {
      alert('Error sending notification');
    } finally {
      setIsNotifying(false);
    }
  };

  const formatTarget = (discount: Discount) => {
    if (!discount.target_id) return '';
    
    if (discount.scope === 'CATEGORY') {
      const cat = categories.find(c => c.id === discount.target_id);
      return cat ? cat.name : discount.target_id;
    }
    
    if (discount.scope === 'SUBCATEGORY') {
      for (const cat of categories) {
        const sub = cat.subcategories?.find(s => s.id === discount.target_id);
        if (sub) return `${cat.name} > ${sub.name}`;
      }
      return discount.target_id;
    }
    
    if (discount.scope === 'PRODUCT') {
      const prod = products.find(p => p.id === discount.target_id);
      return prod ? prod.name : discount.target_id;
    }
    
    if (discount.scope === 'VARIANT') {
      const variants = discount.target_id.split(',');
      const formatted = variants.map(v => {
        const [prodId, size, color] = v.split(':');
        const prod = products.find(p => p.id === prodId);
        const pName = prod ? prod.name : 'Unknown Product';
        return `${pName} (${size || 'Any'}, ${color || 'Any'})`;
      });
      return formatted.join(' | ');
    }
    
    return discount.target_id;
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
                        <p className="text-xs text-gray-500 mt-1" title={formatTarget(discount)}>
                          Target: <span className="font-medium text-gray-700">{formatTarget(discount)}</span>
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
                      <button 
                        onClick={() => {
                          setNotifyModalDiscount(discount);
                          const discountVal = discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₦${discount.value} OFF`;
                          setNotifySubject(`Exciting News: ${discount.name} - ${discountVal}!`);
                          setNotifyMessage(`Our ${discount.name} is starting! Get ready to save.`);
                        }} 
                        className="text-gray-400 hover:text-green-600 p-2 transition-colors" 
                        title="Notify Subscribers"
                      >
                        <Send size={18} />
                      </button>
                      <button onClick={() => openModal(discount)} className="text-gray-400 hover:text-blue-600 p-2 transition-colors" title="Edit Discount">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(discount.id)} className="text-gray-400 hover:text-red-600 p-2 transition-colors" title="Delete Discount">
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
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onMouseDown={closeModal}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Discount' : 'Create New Discount'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 p-1">
                <Trash2 size={24} className="hidden" /> {/* Spacer */}
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
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
                      <option value="VARIANT">Product Variant</option>
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

                      {formData.scope === 'VARIANT' && (
                        <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Select Product</label>
                              <select
                                value={variantProductId}
                                onChange={(e) => {
                                  setVariantProductId(e.target.value);
                                  setVariantSize('');
                                  setVariantColor('');
                                }}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                              >
                                <option value="">Choose a product...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </div>
                            
                            {variantProductId && (() => {
                              const selectedProduct = products.find(p => p.id === variantProductId);
                              const config = selectedProduct?.pricing_config;
                              
                              let availableSizes = selectedProduct?.sizes || [];
                              let availableColors = selectedProduct?.colors || [];
                              
                              // If it's combination mode and a size is selected, filter colors
                              if (config && config.mode === 'combination' && variantSize) {
                                const combinationPrices = config.combinationPrices || {};
                                availableColors = Object.keys(combinationPrices)
                                  .filter(key => key.startsWith(`${variantSize}|`))
                                  .map(key => key.split('|')[1]);
                              }
                              
                              // Ensure color selection is valid when size changes
                              // (useEffect logic has been moved to the top level of the component)

                              return (
                                <div className="grid grid-cols-2 gap-3">
                                  {availableSizes.length > 0 && (
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Select Size/Age</label>
                                      <select
                                        value={variantSize}
                                        onChange={(e) => setVariantSize(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                      >
                                        <option value="" disabled>Choose size...</option>
                                        {availableSizes.map(size => (
                                          <option key={size} value={size}>{size}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  
                                  {availableColors.length > 0 && (
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Select Color</label>
                                      <select
                                        value={variantColor}
                                        onChange={(e) => setVariantColor(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        disabled={config?.mode === 'combination' && !variantSize}
                                      >
                                        <option value="" disabled>{config?.mode === 'combination' && !variantSize ? 'Select size first...' : 'Choose color...'}</option>
                                        {availableColors.map(color => (
                                          <option key={color} value={color}>{color}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!variantProductId) return;
                                  
                                  const selectedProduct = products.find(p => p.id === variantProductId);
                                  const hasSizes = (selectedProduct?.sizes || []).length > 0;
                                  const hasColors = (selectedProduct?.colors || []).length > 0;
                                  
                                  if (hasSizes && !variantSize) return alert('Please select a size');
                                  if (hasColors && !variantColor) return alert('Please select a color');
                                  
                                  // Avoid duplicates
                                  const isDuplicate = addedVariants.some(v => 
                                    v.productId === variantProductId && 
                                    v.size === variantSize && 
                                    v.color === variantColor
                                  );
                                  
                                  if (isDuplicate) return alert('This variant has already been added.');
                                  
                                  setAddedVariants([...addedVariants, {
                                    productId: variantProductId,
                                    size: variantSize,
                                    color: variantColor
                                  }]);
                                  
                                  // Reset selections
                                  setVariantSize('');
                                  setVariantColor('');
                                }}
                                disabled={!variantProductId}
                                className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                              >
                                <Plus size={14} /> Add Variant to Discount
                              </button>
                            </div>
                          </div>
                          
                          {addedVariants.length > 0 && (
                            <div className="mt-4 border-t border-gray-200 pt-4">
                              <label className="block text-xs font-semibold text-gray-700 mb-2">Targeted Variants ({addedVariants.length})</label>
                              <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                                {addedVariants.map((v, i) => {
                                  const p = products.find(prod => prod.id === v.productId);
                                  return (
                                    <div key={i} className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded-md shadow-sm">
                                      <div className="text-sm">
                                        <span className="font-medium text-gray-900">{p?.name || 'Unknown Product'}</span>
                                        <span className="text-gray-500 ml-2">
                                          {v.size && `• ${v.size} `}
                                          {v.color && `• ${v.color}`}
                                        </span>
                                      </div>
                                      <button 
                                        type="button"
                                        onClick={() => setAddedVariants(addedVariants.filter((_, idx) => idx !== i))}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
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

      {/* Notify Modal */}
      {notifyModalDiscount && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onMouseDown={() => setNotifyModalDiscount(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Notify Subscribers</h2>
            <p className="text-gray-600 mb-6">
              Send an immediate email to all your active subscribers about <strong>{notifyModalDiscount.name}</strong>.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Subject</label>
                <input
                  type="text"
                  value={notifySubject}
                  onChange={(e) => setNotifySubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Message</label>
                <textarea
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none h-32"
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setNotifyModalDiscount(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                disabled={isNotifying}
              >
                Cancel
              </button>
              <button 
                onClick={handleNotifySubmit}
                disabled={isNotifying || !notifySubject || !notifyMessage}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {isNotifying ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {isNotifying ? 'Sending...' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
