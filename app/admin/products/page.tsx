// app/admin/products/page.tsx - WITH IMAGE COMPRESSION
'use client';

import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { uploadProductImage } from '@/app/actions/upload';
import imageCompression from 'browser-image-compression';

const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: file.type,
    initialQuality: 0.8,
  };
  
  try {
    console.log('Original file size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    const compressedFile = await imageCompression(file, options);
    console.log('Compressed file size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
    return compressedFile;
  } catch (error) {
    console.error('Compression error:', error);
    return file;
  }
};

export default function AdminProducts() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'men',
    stock: 0,
    colors: [''],
    sizes: [''],
    details: [''],
  });
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      setError('');
      setSuccess(false);
      
      try {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          setError(`Invalid file type: ${file.type}. Use JPEG, PNG, WebP, or GIF.`);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setIsCompressing(false);
          return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
          setError(`Image too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max 10MB before compression.`);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setIsCompressing(false);
          return;
        }
        
        let processedFile = file;
        
        if (file.size > 1 * 1024 * 1024) {
          console.log('Compressing image...');
          processedFile = await compressImage(file);
        }
        
        setMainImage(processedFile);
        setImagePreview(URL.createObjectURL(processedFile));
        console.log('Image ready:', processedFile.name, `${(processedFile.size / 1024 / 1024).toFixed(2)}MB`);
        
      } catch (error: any) {
        console.error('Image processing error:', error);
        setError(`Failed to process image: ${error.message}`);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Product name is required');
      return;
    }
    
    if (!mainImage) {
      setError('Please select an image');
      return;
    }

    if (isCompressing) {
      setError('Please wait for image compression to complete');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('image', mainImage);
      const uploadResult = await uploadProductImage(uploadFormData);
      
      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      const productData = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        category: formData.category,
        main_image: uploadResult.url!,
        images: [],
        colors: formData.colors.filter(c => c.trim() !== ''),
        sizes: formData.sizes.filter(s => s.trim() !== ''),
        stock: formData.stock,
        details: formData.details.filter(d => d.trim() !== ''),
      };

      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save product');
      }

      setSuccess(true);
      
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      category: 'men',
      stock: 0,
      colors: [''],
      sizes: [''],
      details: [''],
    });
    setMainImage(null);
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSuccess(false);
    setError('');
  };

  const addDetailInput = () => {
  setFormData({...formData, details: [...formData.details, '']});
};

const removeDetailInput = (index: number) => {
  const newDetails = formData.details.filter((_, i) => i !== index);
  setFormData({...formData, details: newDetails});
};

const updateDetail = (index: number, value: string) => {
  const newDetails = [...formData.details];
  newDetails[index] = value;
  setFormData({...formData, details: newDetails});
};

  const addColorInput = () => {
    setFormData({...formData, colors: [...formData.colors, '']});
  };

  const removeColorInput = (index: number) => {
    const newColors = formData.colors.filter((_, i) => i !== index);
    setFormData({...formData, colors: newColors});
  };

  const updateColor = (index: number, value: string) => {
    const newColors = [...formData.colors];
    newColors[index] = value;
    setFormData({...formData, colors: newColors});
  };

  const addSizeInput = () => {
    setFormData({...formData, sizes: [...formData.sizes, '']});
  };

  const removeSizeInput = (index: number) => {
    const newSizes = formData.sizes.filter((_, i) => i !== index);
    setFormData({...formData, sizes: newSizes});
  };

  const updateSize = (index: number, value: string) => {
    const newSizes = [...formData.sizes];
    newSizes[index] = value;
    setFormData({...formData, sizes: newSizes});
  };

  if (success) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Product Added Successfully!</h2>
          <p className="text-gray-600 mb-8">Your product has been added to the store.</p>
          <div className="space-y-4">
            <button
              onClick={resetForm}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Add Another Product
            </button>
            <a
              href="/admin/dashboard"
              className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Add New Product</h1>
        <p className="text-gray-600">Upload products to your store</p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 font-medium">Error: {error}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Product Name */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Product Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
            placeholder="e.g., Essential Cotton Tee"
            required
            disabled={isSubmitting || isCompressing}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
            placeholder="Describe your product..."
            disabled={isSubmitting || isCompressing}
          />
        </div>

        {/* Product Image Upload */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Main Product Image *
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="mx-auto max-h-64 rounded-lg object-contain"
                />
                {isCompressing && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white mx-auto mb-2"></div>
                      <p className="text-sm">Compressing...</p>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMainImage(null);
                    setImagePreview('');
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                  title="Remove image"
                  disabled={isSubmitting || isCompressing}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-600 mb-1">Click to upload product image</p>
                <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB (auto-compressed to 1MB)</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              id="image-upload"
              required
              disabled={isSubmitting || isCompressing}
            />
            <label
              htmlFor="image-upload"
              className={`mt-4 inline-block px-6 py-3 rounded-lg font-medium ${
                isSubmitting || isCompressing
                  ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
              } transition-colors`}
            >
              {isCompressing ? 'Processing Image...' : mainImage ? 'Change Image' : 'Choose Image'}
            </label>
            {mainImage && (
              <p className="text-xs text-gray-500 mt-2">
                Size: {(mainImage.size / 1024 / 1024).toFixed(2)}MB
                {mainImage.size > 1 * 1024 * 1024 && ' (compressed)'}
              </p>
            )}
          </div>
        </div>

        {/* Price and Stock */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Price (₦) *
            </label>
            <input
              type="number"
              value={formData.price || ''}
              onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              min="0"
              step="100"
              placeholder="8500"
              required
              disabled={isSubmitting || isCompressing}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Stock Quantity *
            </label>
            <input
              type="number"
              value={formData.stock || ''}
              onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              min="0"
              placeholder="50"
              required
              disabled={isSubmitting || isCompressing}
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Category *
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({...formData, category: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
            required
            disabled={isSubmitting || isCompressing}
          >
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Unisex</option>
          </select>
        </div>

        {/* Colors */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Available Colors *
            </label>
            <button
              type="button"
              onClick={addColorInput}
              className={`text-sm ${
                isSubmitting || isCompressing ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'
              }`}
              disabled={isSubmitting || isCompressing}
            >
              + Add color
            </button>
          </div>
          {formData.colors.map((color, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={color}
                onChange={(e) => updateColor(index, e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-black"
                placeholder="e.g., Black"
                required={index === 0}
                disabled={isSubmitting || isCompressing}
              />
              {formData.colors.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeColorInput(index)}
                  className="px-4 text-red-600 hover:bg-red-50 rounded-lg disabled:text-gray-400"
                  disabled={isSubmitting || isCompressing}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Sizes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Available Sizes *
            </label>
            <button
              type="button"
              onClick={addSizeInput}
              className={`text-sm ${
                isSubmitting || isCompressing ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'
              }`}
              disabled={isSubmitting || isCompressing}
            >
              + Add size
            </button>
          </div>
          {formData.sizes.map((size, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={size}
                onChange={(e) => updateSize(index, e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-black"
                placeholder="e.g., M"
                required={index === 0}
                disabled={isSubmitting || isCompressing}
              />
              {formData.sizes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSizeInput(index)}
                  className="px-4 text-red-600 hover:bg-red-50 rounded-lg disabled:text-gray-400"
                  disabled={isSubmitting || isCompressing}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div>
  <div className="flex items-center justify-between mb-2">
    <label className="block text-sm font-medium text-gray-700">
      Product Details (List)
    </label>
    <button
      type="button"
      onClick={addDetailInput}
      className={`text-sm ${
        isSubmitting || isCompressing ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'
      }`}
      disabled={isSubmitting || isCompressing}
    >
      + Add detail
    </button>
  </div>
  <p className="text-sm text-gray-500 mb-3">Each item will be shown as a bullet point</p>
  {formData.details.map((detail, index) => (
    <div key={index} className="flex gap-2 mb-2">
      <input
        type="text"
        value={detail}
        onChange={(e) => updateDetail(index, e.target.value)}
        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-black"
        placeholder="e.g., 100% Premium Cotton"
        disabled={isSubmitting || isCompressing}
      />
      {formData.details.length > 1 && (
        <button
          type="button"
          onClick={() => removeDetailInput(index)}
          className="px-4 text-red-600 hover:bg-red-50 rounded-lg disabled:text-gray-400"
          disabled={isSubmitting || isCompressing}
        >
          Remove
        </button>
      )}
    </div>
  ))}
</div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isCompressing || !mainImage}
          className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Adding Product...
            </span>
          ) : isCompressing ? (
            'Processing Image...'
          ) : !mainImage ? (
            '📦 Select Image First'
          ) : (
            '📦 Add Product to Store'
          )}
        </button>
      </form>
    </div>
  );
}