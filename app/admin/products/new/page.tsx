// app/admin/products/new/page.tsx - ADD NEW PRODUCT
"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, ArrowLeft, Star, Plus } from "lucide-react";
import Link from "next/link";
import { uploadProductImage } from "@/app/actions/upload";
import imageCompression from "browser-image-compression";
import { PricingMode } from "@/types/product";

import { z } from "zod";
import { useForm, useFieldArray, SubmitHandler, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema for form validation
const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional().default(""),
  price: z.coerce.number().min(0, "Price must be a positive number"),
  category: z.string().min(1, "Category is required"),
  sub_category: z.string().optional(),
  stock: z.coerce.number().min(0, "Stock must be a positive number"),
  colors: z.array(z.object({ value: z.string().min(1, "Color cannot be empty") })).min(1, "At least one color is required"),
  sizes: z.array(z.object({ value: z.string().min(1, "Size cannot be empty") })).min(1, "At least one size is required"),
  details: z.array(z.object({ value: z.string().min(1, "Detail cannot be empty") })).optional().default([]),
});

type ProductFormValues = z.infer<typeof productSchema>;

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
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error("Compression error:", error);
    return file;
  }
};

interface ImageFile {
  file: File | null;
  url: string;
  isMain: boolean;
  isUploading?: boolean;
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories: Subcategory[];
}

export default function AddProductPage() {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      category: "",
      sub_category: "",
      stock: 0,
      colors: [{ value: "" }],
      sizes: [{ value: "" }],
      details: [{ value: "" }],
    },
  });

  const { fields: colorFields, append: appendColor, remove: removeColor } = useFieldArray({
    control: control as any,
    name: "colors",
  });

  const { fields: sizeFields, append: appendSize, remove: removeSize } = useFieldArray({
    control: control as any,
    name: "sizes",
  });

  const { fields: detailFields, append: appendDetail, remove: removeDetail } = useFieldArray({
    control: control as any,
    name: "details",
  });

  const [images, setImages] = useState<ImageFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [pricingMode, setPricingMode] = useState<PricingMode>('single');
  const [sizePrices, setSizePrices] = useState<Record<string, number>>({});
  const [colorPrices, setColorPrices] = useState<Record<string, number>>({});
  const [combinationPrices, setCombinationPrices] = useState<Record<string, number>>({});


  // Watch the category field to update the sub_category options
  const selectedCategorySlug = useWatch({ control, name: "category" });

  const watchedSizes = useWatch({ control: control as any, name: 'sizes' });
  const watchedColors = useWatch({ control: control as any, name: 'colors' });

  const selectedCategory = categories.find(c => c.slug === selectedCategorySlug);

  useEffect(() => {
    fetch('/api/admin/categories')
      .then(res => res.json())
      .then(data => {
        if (data.success) setCategories(data.categories || []);
        setLoadingCategories(false);
      })
      .catch(err => {
        console.error('Failed to fetch categories', err);
        setLoadingCategories(false);
      });
  }, []);

  const handleImageUpload = async (files: FileList) => {
    const newImages: ImageFile[] = [];
    const imageErrors: string[] = [];

    setIsCompressing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
          imageErrors.push(`Invalid file type: ${file.type}. File: ${file.name}`);
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          imageErrors.push(`Image too large (${(file.size / 1024 / 1024).toFixed(2)}MB): ${file.name}. Max 10MB.`);
          continue;
        }

        let processedFile = file;
        if (file.size > 1 * 1024 * 1024) {
          processedFile = await compressImage(file);
        }

        const url = URL.createObjectURL(processedFile);
        newImages.push({
          file: processedFile,
          url,
          isMain: images.length === 0 && newImages.length === 0,
          isUploading: false,
        });
      } catch (error: any) {
        imageErrors.push(`Failed to process ${file.name}: ${error.message}`);
      }
    }

    setIsCompressing(false);

    setImages((prev) => {
      const updatedImages = [...prev];
      if (updatedImages.length === 0 && newImages.length > 0) {
        newImages[0].isMain = true;
      }
      return [...updatedImages, ...newImages];
    });

    if (imageErrors.length > 0) {
      setSubmitError(`Some images failed to upload:\n${imageErrors.join("\n")}`);
      setTimeout(() => setSubmitError(""), 5000);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSubmitError("");
    setSuccess(false);
    await handleImageUpload(files);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      const removedImage = newImages[index];
      if (removedImage.file) URL.revokeObjectURL(removedImage.url);
      newImages.splice(index, 1);
      if (removedImage.isMain && newImages.length > 0) {
        newImages[0].isMain = true;
      }
      return newImages;
    });
  };

  const setAsMainImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      newImages.forEach((img) => (img.isMain = false));
      newImages[index].isMain = true;
      return newImages;
    });
  };

  const onSubmit: SubmitHandler<ProductFormValues> = async (data) => {
    if (images.length === 0) {
      setSubmitError("Please add at least one product image");
      return;
    }

    const mainImage = images.find((img) => img.isMain);
    if (!mainImage) {
      setSubmitError("Please select a main image (click the star icon on any image)");
      return;
    }

    if (isCompressing) {
      setSubmitError("Please wait for image compression to complete");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSuccess(false);

    try {
      const uploadedImages: string[] = [];

      for (const image of images) {
        let imageUrl = image.url;
        if (image.file) {
          const uploadFormData = new FormData();
          uploadFormData.append("image", image.file);
          const uploadResult = await uploadProductImage(uploadFormData);
          if (uploadResult.error) throw new Error(uploadResult.error);
          imageUrl = uploadResult.url!;
        }
        uploadedImages.push(imageUrl);
      }

      const mainImageIndex = images.findIndex((img) => img.isMain);
      const mainImageUrl = uploadedImages[mainImageIndex];
      const additionalImages = uploadedImages.filter((_, index) => index !== mainImageIndex);

      const productData = {
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        sub_category: data.sub_category,
        main_image: mainImageUrl,
        images: additionalImages,
        colors: data.colors.map(c => c.value).filter((c) => c.trim() !== ""),
        sizes: data.sizes.map(s => s.value).filter((s) => s.trim() !== ""),
        stock: data.stock,
        details: data.details?.map(d => d.value).filter((d) => d.trim() !== "") || [],
        pricing_config: pricingMode === 'single' ? { mode: 'single' } : {
          mode: pricingMode,
          sizePrices: pricingMode === 'size' ? sizePrices : undefined,
          colorPrices: pricingMode === 'color' ? colorPrices : undefined,
          combinationPrices: pricingMode === 'combination' ? combinationPrices : undefined
        }
      };

      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. Please check the API route.`);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to create product");

      setSuccess(true);
    } catch (error: any) {
      setSubmitError(error.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Success!</h2>
          <p className="text-gray-600 mb-8">Your product has been beautifully added to the store.</p>
          <div className="space-y-4">
            <Link href="/admin/products" className="block w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-center shadow-md">
              View All Products
            </Link>
            <button
              onClick={() => {
                reset();
                setImages([]);
                setSubmitError("");
                setSuccess(false);
              }}
              className="block w-full border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Add Another Product
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin/products" className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium mb-6 transition-colors bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100">
          <ArrowLeft size={20} />
          Back to Products
        </Link>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50/50 px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
            <p className="text-gray-500 mt-1">Fill out the details to add a new product to your inventory.</p>
          </div>

          <div className="p-8">
            {submitError && (
              <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <div className="bg-red-100 p-1.5 rounded-full mt-0.5">
                  <X size={16} className="text-red-600" />
                </div>
                <p className="text-red-700 font-medium whitespace-pre-line leading-relaxed">{submitError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-8">
              {/* Product Info Section */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Product Name <span className="text-red-500">*</span></label>
                  <input
                    {...register("name")}
                    type="text"
                    className={`w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black transition-colors ${errors.name ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                    placeholder="e.g., Premium Cotton Tee"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1.5">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                  <textarea
                    {...register("description")}
                    className={`w-full border rounded-xl px-4 py-3 h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black transition-colors ${errors.description ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                    placeholder="Describe your product beautifully..."
                  />
                  {errors.description && <p className="text-red-500 text-sm mt-1.5">{errors.description.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Price (₦) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₦</span>
                      <input
                        {...register("price")}
                        type="number"
                        className={`w-full border rounded-xl pl-8 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black transition-colors ${errors.price ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                        min="0" step="100" placeholder="0"
                      />
                    </div>
                    {errors.price && <p className="text-red-500 text-sm mt-1.5">{errors.price.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Stock Quantity <span className="text-red-500">*</span></label>
                    <input
                      {...register("stock")}
                      type="number"
                      className={`w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black transition-colors ${errors.stock ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                      min="0" placeholder="0"
                    />
                    {errors.stock && <p className="text-red-500 text-sm mt-1.5">{errors.stock.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Category <span className="text-red-500">*</span></label>
                    <select
                      {...register("category")}
                      className={`w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white transition-colors ${errors.category ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                      disabled={loadingCategories}
                    >
                      <option value="">Select a category...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.slug}>{cat.name}</option>
                      ))}
                    </select>
                    {errors.category && <p className="text-red-500 text-sm mt-1.5">{errors.category.message}</p>}
                  </div>

                  {selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Subcategory</label>
                      <select
                        {...register("sub_category")}
                        className={`w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white transition-colors border-gray-200`}
                      >
                        <option value="">No subcategory (optional)</option>
                        {selectedCategory.subcategories.map(sub => (
                          <option key={sub.id} value={sub.slug}>{sub.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Dynamic Fields Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Colors */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-bold text-gray-800">Colors <span className="text-red-500">*</span></label>
                    <button type="button" onClick={() => appendColor({ value: "" })} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">+ Add</button>
                  </div>
                  <div className="space-y-3">
                    {colorFields.map((field, index) => (
                      <div key={field.id}>
                        <div className="flex gap-2">
                          <input
                            {...register(`colors.${index}.value`)}
                            className={`flex-1 border rounded-lg px-3 py-2 text-black ${errors.colors?.[index]?.value ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                            placeholder="e.g., Red"
                          />
                          {colorFields.length > 1 && (
                            <button type="button" onClick={() => removeColor(index)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={20} /></button>
                          )}
                        </div>
                        {errors.colors?.[index]?.value && <p className="text-red-500 text-xs mt-1">{errors.colors[index]?.value?.message}</p>}
                      </div>
                    ))}
                  </div>
                  {errors.colors && !Array.isArray(errors.colors) && <p className="text-red-500 text-sm mt-2">{errors.colors.message}</p>}
                </div>

                {/* Sizes */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-bold text-gray-800">Sizes <span className="text-red-500">*</span></label>
                    <button type="button" onClick={() => appendSize({ value: "" })} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">+ Add</button>
                  </div>
                  <div className="space-y-3">
                    {sizeFields.map((field, index) => (
                      <div key={field.id}>
                        <div className="flex gap-2">
                          <input
                            {...register(`sizes.${index}.value`)}
                            className={`flex-1 border rounded-lg px-3 py-2 text-black ${errors.sizes?.[index]?.value ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                            placeholder="e.g., XL"
                          />
                          {sizeFields.length > 1 && (
                            <button type="button" onClick={() => removeSize(index)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={20} /></button>
                          )}
                        </div>
                        {errors.sizes?.[index]?.value && <p className="text-red-500 text-xs mt-1">{errors.sizes[index]?.value?.message}</p>}
                      </div>
                    ))}
                  </div>
                  {errors.sizes && !Array.isArray(errors.sizes) && <p className="text-red-500 text-sm mt-2">{errors.sizes.message}</p>}
                </div>

                
                {/* Pricing Configuration */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 md:col-span-2">
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-800 mb-2">Pricing Mode</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      {[
                        { id: 'single', label: 'Single' },
                        { id: 'size', label: 'By Size' },
                        { id: 'color', label: 'By Color' },
                        { id: 'combination', label: 'Combined' }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setPricingMode(mode.id as PricingMode)}
                          className={`px-2 py-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors ${pricingMode === mode.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {pricingMode === 'size' && (
                    <div className="space-y-3 mt-4">
                      <p className="text-sm text-gray-600 font-medium">Set price for each size (leave blank to use base price):</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {watchedSizes?.map((s: any, i: number) => s?.value ? (
                          <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200">
                            <span className="font-medium text-gray-700 w-20 truncate">{s.value}</span>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                              <input
                                type="number"
                                className="w-full border-gray-200 border rounded-lg pl-8 pr-3 py-1.5 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Base Price"
                                value={sizePrices[s.value] || ''}
                                onChange={(e) => setSizePrices(prev => ({ ...prev, [s.value]: Number(e.target.value) || 0 }))}
                              />
                            </div>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  )}

                  {pricingMode === 'color' && (
                    <div className="space-y-3 mt-4">
                      <p className="text-sm text-gray-600 font-medium">Set price for each color (leave blank to use base price):</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {watchedColors?.map((c: any, i: number) => c?.value ? (
                          <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200">
                            <span className="font-medium text-gray-700 w-20 truncate">{c.value}</span>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                              <input
                                type="number"
                                className="w-full border-gray-200 border rounded-lg pl-8 pr-3 py-1.5 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Base Price"
                                value={colorPrices[c.value] || ''}
                                onChange={(e) => setColorPrices(prev => ({ ...prev, [c.value]: Number(e.target.value) || 0 }))}
                              />
                            </div>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  )}

                  {pricingMode === 'combination' && (
                    <div className="space-y-3 mt-4">
                      <p className="text-sm text-gray-600 font-medium">Set price for combinations (leave blank to use base price):</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {watchedSizes?.map((s: any) => 
                          s?.value ? watchedColors?.map((c: any) => 
                            c?.value ? (
                              <div key={`${s.value}|${c.value}`} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200">
                                <span className="font-medium text-gray-700 w-32 truncate">{s.value} + {c.value}</span>
                                <div className="relative flex-1">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                                  <input
                                    type="number"
                                    className="w-full border-gray-200 border rounded-lg pl-8 pr-3 py-1.5 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Base Price"
                                    value={combinationPrices[`${s.value}|${c.value}`] || ''}
                                    onChange={(e) => setCombinationPrices(prev => ({ ...prev, [`${s.value}|${c.value}`]: Number(e.target.value) || 0 }))}
                                  />
                                </div>
                              </div>
                            ) : null
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Details */}

                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 md:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-800">Features & Details</label>
                      <p className="text-xs text-gray-500 mt-0.5">These will appear as bullet points on the product page.</p>
                    </div>
                    <button type="button" onClick={() => appendDetail({ value: "" })} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">+ Add Detail</button>
                  </div>
                  <div className="space-y-3">
                    {detailFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <div className="mt-3 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0"></div>
                        <div className="flex-1">
                          <input
                            {...register(`details.${index}.value`)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-black"
                            placeholder="e.g., 100% Organic Cotton"
                          />
                        </div>
                        <button type="button" onClick={() => removeDetail(index)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={20} /></button>
                      </div>
                    ))}
                    {detailFields.length === 0 && (
                      <p className="text-sm text-gray-400 italic">No features added. Click '+ Add Detail' to include some.</p>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Product Images Upload */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                  <div>
                    <label className="block text-sm font-bold text-gray-800">Product Images <span className="text-red-500">*</span></label>
                    <p className="text-xs text-gray-500 mt-0.5">Upload multiple. Click the star to set the main cover image.</p>
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                    {images.length} image{images.length !== 1 ? "s" : ""} selected
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                  multiple
                />

                <div className={`border-2 border-dashed rounded-xl p-8 transition-colors ${images.length === 0 ? 'border-gray-300 bg-gray-50 hover:bg-gray-100' : 'border-gray-200'}`}>
                  {images.length === 0 ? (
                    <div className="text-center">
                      <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Upload className="h-8 w-8 text-blue-500" />
                      </div>
                      <p className="text-gray-700 font-medium mb-1">Click to upload product images</p>
                      <p className="text-xs text-gray-500 mb-6">PNG, JPG, WEBP up to 10MB (auto-compressed)</p>
                      <label
                        htmlFor="image-upload"
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 cursor-pointer shadow-sm transition-all"
                      >
                        <Plus size={18} /> Add Images
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {images.map((image, index) => (
                          <div key={index} className="relative group rounded-xl overflow-hidden shadow-sm aspect-square bg-gray-100">
                            <div className={`absolute inset-0 border-4 rounded-xl z-10 pointer-events-none transition-colors ${image.isMain ? 'border-blue-500' : 'border-transparent'}`}></div>
                            <img
                              src={image.url}
                              alt={`Product image ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Error'; }}
                            />
                            {image.isMain && (
                              <div className="absolute top-2 left-2 z-20 bg-blue-500 text-white p-1.5 rounded-lg shadow-sm">
                                <Star size={14} fill="white" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center gap-2">
                              {!image.isMain && (
                                <button type="button" onClick={() => setAsMainImage(index)} className="bg-white p-2 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Set as main image">
                                  <Star size={18} />
                                </button>
                              )}
                              <button type="button" onClick={() => removeImage(index)} className="bg-white p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors" title="Remove image">
                                <X size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                        <label htmlFor="image-upload" className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors group">
                          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 group-hover:border-blue-200 group-hover:text-blue-500 mb-2 shadow-sm">
                            <Plus size={20} />
                          </div>
                          <span className="text-xs font-medium text-gray-500 group-hover:text-blue-500">Add More</span>
                        </label>
                      </div>
                      {isCompressing && (
                        <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 py-3 rounded-lg border border-blue-100">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                          <span className="text-sm font-medium">Optimizing images...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting || isCompressing || images.length === 0}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Creating Product...
                    </>
                  ) : isCompressing ? (
                    "Processing Images..."
                  ) : images.length === 0 ? (
                    "Add Images to Continue"
                  ) : (
                    "Publish Product"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
