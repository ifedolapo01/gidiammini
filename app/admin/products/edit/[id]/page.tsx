// app/admin/products/edit/[id]/page.tsx - FIXED DYNAMIC ROUTE
'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload, X, ArrowLeft, Star, Plus } from 'lucide-react';
import Link from 'next/link';
import { uploadProductImage } from '@/app/actions/upload';
import imageCompression from 'browser-image-compression';

// Compression function
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

interface ImageFile {
  file: File | null;
  url: string;
  isMain: boolean;
  isUploading?: boolean;
}

// Add this type for params
type PageProps = {
  params: Promise<{ id: string }>;
};

export default function EditProductPage({ params }: PageProps) {
  const [unwrappedParams, setUnwrappedParams] = useState<{ id: string } | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
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
  
  const [images, setImages] = useState<ImageFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const router = useRouter();
  
  // Unwrap params from Promise
  useEffect(() => {
    const unwrapParams = async () => {
      try {
        const resolvedParams = await params;
        console.log('Resolved params:', resolvedParams);
        setUnwrappedParams(resolvedParams);
      } catch (error) {
        console.error('Error unwrapping params:', error);
        setError('Failed to load product parameters');
        setIsLoading(false);
      }
    };
    
    unwrapParams();
  }, [params]);
  
  // Fetch product when params are available
  useEffect(() => {
    if (unwrappedParams?.id) {
      fetchProduct(unwrappedParams.id);
    }
  }, [unwrappedParams]);
  
  const fetchProduct = async (productId: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log('Fetching product with ID:', productId);
      
      // Try fetching directly from the list API first
      const allProductsResponse = await fetch('/api/admin/products', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (allProductsResponse.ok) {
        const allProductsResult = await allProductsResponse.json();
        
        if (allProductsResult.success) {
          // Find the product in the list
          const productFromList = allProductsResult.products.find((p: Product) => p.id === productId);
          
          if (productFromList) {
            setProduct(productFromList);
            setFormData({
              name: productFromList.name,
              description: productFromList.description || '',
              price: productFromList.price,
              category: productFromList.category,
              stock: productFromList.stock,
              colors: productFromList.colors.length > 0 ? productFromList.colors : [''],
              sizes: productFromList.sizes.length > 0 ? productFromList.sizes : [''],
              details: productFromList.details.length > 0 ? productFromList.details : [''],
            });
            
            const initialImages: ImageFile[] = [
              {
                file: null,
                url: productFromList.main_image,
                isMain: true,
              },
              ...(productFromList.images || []).map((img: string) => ({
                file: null,
                url: img,
                isMain: false,
              }))
            ];
            setImages(initialImages);
            setIsLoading(false);
            return; // Success, exit early
          }
        }
      }
      
      // Fallback to single product API
      console.log('Product not found in list, trying single API...');
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Product not found. It may have been deleted.');
        } else {
          throw new Error(`Failed to load product (Status: ${response.status})`);
        }
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load product');
      }
      
      const productData = result.product;
      setProduct(productData);
      
      // Set form data
      setFormData({
        name: productData.name,
        description: productData.description || '',
        price: productData.price,
        category: productData.category,
        stock: productData.stock,
        colors: productData.colors.length > 0 ? productData.colors : [''],
        sizes: productData.sizes.length > 0 ? productData.sizes : [''],
        details: productData.details.length > 0 ? productData.details : [''],
      });
      
      // Set images
      const initialImages: ImageFile[] = [
        {
          file: null,
          url: productData.main_image,
          isMain: true,
        },
        ...(productData.images || []).map((img: string) => ({
          file: null,
          url: img,
          isMain: false,
        }))
      ];
      setImages(initialImages);
      
    } catch (error: any) {
      console.error('Error fetching product:', error);
      setError(error.message || 'Failed to load product');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleImageUpload = async (files: FileList) => {
    const newImages: ImageFile[] = [];
    const errors: string[] = [];
    
    setIsCompressing(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          errors.push(`Invalid file type: ${file.type}. File: ${file.name}`);
          continue;
        }
        
        // Validate size
        if (file.size > 10 * 1024 * 1024) {
          errors.push(`Image too large (${(file.size / 1024 / 1024).toFixed(2)}MB): ${file.name}. Max 10MB.`);
          continue;
        }
        
        let processedFile = file;
        
        // Compress if needed
        if (file.size > 1 * 1024 * 1024) {
          processedFile = await compressImage(file);
        }
        
        const url = URL.createObjectURL(processedFile);
        newImages.push({
          file: processedFile,
          url,
          isMain: false, // New images are not main by default
          isUploading: false,
        });
        
      } catch (error: any) {
        errors.push(`Failed to process ${file.name}: ${error.message}`);
      }
    }
    
    setIsCompressing(false);
    
    // Add new images
    setImages(prev => [...prev, ...newImages]);
    
    // Show any errors
    if (errors.length > 0) {
      setError(`Some images failed to upload:\n${errors.join('\n')}`);
      
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        setError('');
      }, 5000);
    }
  };
  
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setError('');
    setSuccess(false);
    await handleImageUpload(files);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      const removedImage = newImages[index];
      
      // Revoke object URL to prevent memory leak
      if (removedImage.file) {
        URL.revokeObjectURL(removedImage.url);
      }
      
      // Remove the image
      newImages.splice(index, 1);
      
      // If we removed the main image and there are other images, set first as main
      if (removedImage.isMain && newImages.length > 0) {
        newImages[0].isMain = true;
      }
      
      return newImages;
    });
  };
  
  const setAsMainImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      
      // Reset all isMain to false
      newImages.forEach(img => img.isMain = false);
      
      // Set selected image as main
      newImages[index].isMain = true;
      
      return newImages;
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!unwrappedParams?.id) {
      setError('Product ID is missing');
      return;
    }
    
    // Validation
    if (!formData.name.trim()) {
      setError('Product name is required');
      return;
    }
    
    if (images.length === 0) {
      setError('Please add at least one product image');
      return;
    }
    
    // Check if we have a main image
    const mainImage = images.find(img => img.isMain);
    if (!mainImage) {
      setError('Please select a main image (click the star icon on any image)');
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
      // Upload all new images
      const uploadedImages: string[] = [];
      
      for (const image of images) {
        let imageUrl = image.url;
        
        // If it's a new file (not from existing product), upload it
        if (image.file) {
          const uploadFormData = new FormData();
          uploadFormData.append('image', image.file);
          
          try {
            const uploadResult = await uploadProductImage(uploadFormData);
            if (uploadResult.error) {
              throw new Error(uploadResult.error);
            }
            imageUrl = uploadResult.url!;
          } catch (uploadError: any) {
            console.error('Failed to upload image:', uploadError);
            throw new Error(`Failed to upload image: ${uploadError.message}`);
          }
        }
        
        uploadedImages.push(imageUrl);
      }
      
      // Get main image URL
      const mainImageIndex = images.findIndex(img => img.isMain);
      const mainImageUrl = uploadedImages[mainImageIndex];
      
      // Remove main image from additional images
      const additionalImages = uploadedImages.filter((_, index) => index !== mainImageIndex);
      
      const productData = {
        id: unwrappedParams.id,
        name: formData.name,
        description: formData.description,
        price: formData.price,
        category: formData.category,
        main_image: mainImageUrl,
        images: additionalImages,
        colors: formData.colors.filter(c => c.trim() !== ''),
        sizes: formData.sizes.filter(s => s.trim() !== ''),
        stock: formData.stock,
        details: formData.details.filter(d => d.trim() !== ''),
      };
      
      console.log('Updating product with data:', productData);
      
      const response = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      
      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 500));
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update product');
      }
      
      setSuccess(true);
      
      // Redirect to products list after 2 seconds
      setTimeout(() => {
        router.push('/admin/products');
        router.refresh(); // Refresh to get updated data
      }, 2000);
      
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Helper functions for dynamic fields
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
  
  if (isLoading) {
    return (
      <div className="p-6">
        <Link
          href="/admin/products"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Products
        </Link>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  if (error && !product) {
    return (
      <div className="p-6">
        <Link
          href="/admin/products"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Products
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Error Loading Product</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-8">Product ID: {unwrappedParams?.id || 'Not available'}</p>
          <div className="space-y-3">
            <Link
              href="/admin/products"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Back to Products
            </Link>
            <button
              onClick={() => unwrappedParams?.id && fetchProduct(unwrappedParams.id)}
              className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Success view
  if (success) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Product Updated Successfully!
          </h2>
          <p className="text-gray-600 mb-8">
            Your product has been updated. Redirecting to products list...
          </p>
          <Link
            href="/admin/products"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            Go to Products Now
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <Link
        href="/admin/products"
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Products
      </Link>
      
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Edit Product</h1>
        <p className="text-gray-600">Update product details</p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 font-medium whitespace-pre-line">Error: {error}</p>
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
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
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
            className="w-full border border-gray-300 rounded-lg px-4 py-3 h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="Describe your product..."
            disabled={isSubmitting || isCompressing}
          />
        </div>

        {/* Product Images Upload */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Product Images *
              <span className="text-gray-500 text-sm font-normal ml-2">
                (Click star to set as main image)
              </span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {images.length} image{images.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            id="image-upload"
            multiple
            disabled={isSubmitting || isCompressing}
          />
          
          {/* Image upload area */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <div className={`aspect-square rounded-lg overflow-hidden border-2 ${
                      image.isMain ? 'border-yellow-500' : 'border-gray-200'
                    }`}>
                      <img
                        src={image.url}
                        alt={`Product image ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Image+Error';
                        }}
                      />
                    </div>
                    
                    {/* Main image indicator */}
                    {image.isMain && (
                      <div className="absolute top-2 left-2 bg-yellow-500 text-white p-1.5 rounded-full">
                        <Star size={14} fill="white" />
                      </div>
                    )}
                    
                    {/* Image controls */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-2">
                        {!image.isMain && (
                          <button
                            type="button"
                            onClick={() => setAsMainImage(index)}
                            className="bg-white p-2 rounded-full hover:bg-gray-100 transition-colors"
                            title="Set as main image"
                            disabled={isSubmitting || isCompressing}
                          >
                            <Star size={16} className="text-yellow-600" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="bg-white p-2 rounded-full hover:bg-gray-100 transition-colors"
                          title="Remove image"
                          disabled={isSubmitting || isCompressing}
                        >
                          <X size={16} className="text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Add more images button */}
                <label
                  htmlFor="image-upload"
                  className={`aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isSubmitting || isCompressing
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <Plus className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Add More</span>
                </label>
              </div>
              
              {/* Compression status */}
              {isCompressing && (
                <div className="flex items-center justify-center text-blue-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-500 mr-2"></div>
                  <span className="text-sm">Compressing images...</span>
                </div>
              )}
            </div>
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
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
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
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              className={`text-sm px-3 py-1 rounded ${
                isSubmitting || isCompressing 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
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
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="e.g., Black"
                required={index === 0}
                disabled={isSubmitting || isCompressing}
              />
              {formData.colors.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeColorInput(index)}
                  className="px-4 text-red-600 hover:bg-red-50 rounded-lg disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
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
              className={`text-sm px-3 py-1 rounded ${
                isSubmitting || isCompressing 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
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
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="e.g., M"
                required={index === 0}
                disabled={isSubmitting || isCompressing}
              />
              {formData.sizes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSizeInput(index)}
                  className="px-4 text-red-600 hover:bg-red-50 rounded-lg disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  disabled={isSubmitting || isCompressing}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Product Details (List)
            </label>
            <button
              type="button"
              onClick={addDetailInput}
              className={`text-sm px-3 py-1 rounded ${
                isSubmitting || isCompressing 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
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
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="e.g., 100% Premium Cotton"
                disabled={isSubmitting || isCompressing}
              />
              {formData.details.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDetailInput(index)}
                  className="px-4 text-red-600 hover:bg-red-50 rounded-lg disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
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
          disabled={isSubmitting || isCompressing || images.length === 0}
          className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating Product...
            </span>
          ) : isCompressing ? (
            'Processing Images...'
          ) : images.length === 0 ? (
            '📷 Add Images First'
          ) : (
            `📦 Update Product with ${images.length} Image${images.length !== 1 ? 's' : ''}`
          )}
        </button>
      </form>
    </div>
  );
}