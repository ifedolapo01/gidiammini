// app/admin/products/edit/[id]/page.tsx - EDIT PRODUCT
"use client";

import { useState, useRef, useEffect, use, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Upload, X, ArrowLeft, Star, Plus } from "lucide-react";
import Link from "next/link";
import { uploadProductImage } from "@/app/actions/upload";
import imageCompression from "browser-image-compression";
import { PricingMode, PricingConfig } from "@/types/product";

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
  colors: z.array(z.object({ value: z.string() })).optional().default([]),
  sizes: z.array(z.object({ value: z.string() })).optional().default([]),
  sizing_type: z.enum(['size', 'age']).optional().default('size'),
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
  sizing_type?: 'size' | 'age' | null;
  pricing_config?: PricingConfig | null;
  created_at: string;
  updated_at: string;
}

interface ImageFile {
  file: File | null;
  url: string;
  isMain: boolean;
  assignedColor?: string;
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

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function EditProductPage(props: PageProps) {
  const params = use(props.params);
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    getValues,
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
      sizing_type: "size",
      details: [{ value: "" }],
    },
  });

  const { fields: colorFields, append: appendColor, remove: removeColor } = useFieldArray({ control: control as any, name: "colors" });
  const { fields: sizeFields, append: appendSize, remove: removeSize } = useFieldArray({ control: control as any, name: "sizes" });
  const { fields: detailFields, append: appendDetail, remove: removeDetail } = useFieldArray({ control: control as any, name: "details" });

  const handleTitleCaseBlur = (fieldPath: any) => {
    const val = getValues(fieldPath);
    if (typeof val === 'string' && val) {
      const titleCased = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      setValue(fieldPath, titleCased, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleStateTitleCaseBlur = (vIdx: number, cIdx?: number) => {
    const newV = [...variants];
    if (cIdx !== undefined) {
      const val = newV[vIdx].colors[cIdx].name;
      if (val) {
        newV[vIdx].colors[cIdx].name = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        setVariants(newV);
      }
    } else {
      const val = newV[vIdx].size;
      if (val) {
        newV[vIdx].size = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        setVariants(newV);
      }
    }
  };

  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [hasVariants, setHasVariants] = useState(false);
  const [hasSizes, setHasSizes] = useState(false);
  const [hasColors, setHasColors] = useState(false);
  const [sizingType, setSizingType] = useState<'size'|'age'>('size');

  interface VariantColor {
    name: string;
    price: number;
    stock: number;
  }

  interface VariantSize {
    size: string;
    price: number;
    stock: number;
    colors: VariantColor[];
  }

  const [variants, setVariants] = useState<VariantSize[]>([{ size: "", price: 0, stock: 0, colors: [] }]);

  const uniqueColorsArray = useMemo(() => {
    if (!hasVariants || !hasColors) return [];
    const colors = new Set<string>();
    variants.forEach(v => {
      v.colors.forEach(c => {
        const cn = c.name.trim();
        if (cn) colors.add(cn);
      });
    });
    return Array.from(colors);
  }, [hasVariants, hasColors, variants]);

  const uniqueColorsCount = uniqueColorsArray.length;

  // Watch the category field to update the sub_category options
  const selectedCategorySlug = useWatch({ control, name: "category" });

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

  useEffect(() => {
    if (params.id) {
      fetchProduct(params.id);
    }
  }, [params.id]);

  const fetchProduct = async (productId: string) => {
    setIsLoading(true);
    setSubmitError("");

    try {
      let productData: Product | null = null;
      
      const allProductsResponse = await fetch("/api/admin/products", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (allProductsResponse.ok) {
        const allProductsResult = await allProductsResponse.json();
        if (allProductsResult.success) {
          productData = allProductsResult.products.find((p: Product) => p.id === productId);
        }
      }

      if (!productData) {
        const response = await fetch(`/api/admin/products/${productId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          if (response.status === 404) throw new Error("Product not found. It may have been deleted.");
          throw new Error(`Failed to load product (Status: ${response.status})`);
        }

        const result = await response.json();
        if (!result.success) throw new Error(result.error || "Failed to load product");
        productData = result.product;
      }

      if (productData) {
        setProduct(productData);
        reset({
          name: productData.name,
          description: productData.description || "",
          price: productData.price,
          category: productData.category || "",
          sub_category: (productData as any).sub_category || "",
          stock: productData.stock,
          sizing_type: productData.sizing_type || 'size',
          colors: productData.colors.length > 0 ? productData.colors.map(c => ({ value: c })) : [{ value: "" }],
          sizes: productData.sizes.length > 0 ? productData.sizes.map(s => ({ value: s })) : [{ value: "" }],
          details: productData.details.length > 0 ? productData.details.map(d => ({ value: d })) : [{ value: "" }],
        });

        const colorImagesMap = productData.pricing_config?.colorImages || {};
        const getAssignedColor = (url: string) => {
          for (const [color, mappedUrl] of Object.entries(colorImagesMap)) {
            if (mappedUrl === url) return color;
          }
          return undefined;
        };

        const initialImages: ImageFile[] = [
          { file: null, url: productData.main_image, isMain: true, assignedColor: getAssignedColor(productData.main_image) },
          ...(productData.images || []).map((img: string) => ({ file: null, url: img, isMain: false, assignedColor: getAssignedColor(img) }))
        ];
        setImages(initialImages);

        if (productData.pricing_config) {
          const config = productData.pricing_config;
          setSizingType(productData.sizing_type || 'size');
          
          if (config.mode === 'single') {
            setHasVariants(false);
            setHasSizes(false);
            setHasColors(false);
            setVariants([{ size: "", price: productData.price, stock: config.singleStock || productData.stock, colors: [] }]);
          } else {
            setHasVariants(true);
            const newVariants: VariantSize[] = [];
            
            if (config.mode === 'combination') {
              setHasSizes(true);
              setHasColors(true);
              
              const prices = config.combinationPrices || {};
              const stocks = config.combinationStock || {};
              const sizeMap = new Map<string, VariantColor[]>();
              
              Object.keys(prices).forEach(key => {
                const [size, color] = key.split('|');
                if (size && color) {
                  if (!sizeMap.has(size)) sizeMap.set(size, []);
                  sizeMap.get(size)!.push({
                    name: color,
                    price: prices[key] || 0,
                    stock: stocks[key] || 0
                  });
                }
              });
              
              sizeMap.forEach((colors, size) => {
                newVariants.push({
                  size,
                  price: 0,
                  stock: 0,
                  colors
                });
              });
              
              if (newVariants.length === 0) newVariants.push({ size: "", price: 0, stock: 0, colors: [] });
              
            } else if (config.mode === 'size') {
              setHasSizes(true);
              setHasColors(false);
              
              const prices = config.sizePrices || {};
              const stocks = config.sizeStock || {};
              
              Object.keys(prices).forEach(size => {
                newVariants.push({
                  size,
                  price: prices[size] || 0,
                  stock: stocks[size] || 0,
                  colors: []
                });
              });
              
              if (newVariants.length === 0) newVariants.push({ size: "", price: 0, stock: 0, colors: [] });
              
            } else if (config.mode === 'color') {
              setHasSizes(false);
              setHasColors(true);
              
              const prices = config.colorPrices || {};
              const stocks = config.colorStock || {};
              const colors: VariantColor[] = [];
              
              Object.keys(prices).forEach(color => {
                colors.push({
                  name: color,
                  price: prices[color] || 0,
                  stock: stocks[color] || 0
                });
              });
              
              newVariants.push({
                size: "",
                price: 0,
                stock: 0,
                colors
              });
            }
            
            setVariants(newVariants);
          }
        } else {
          setHasVariants(false);
          setVariants([{ size: "", price: productData.price, stock: productData.stock, colors: [] }]);
        }
      }
    } catch (error: any) {
      setSubmitError(error.message || "Failed to load product");
    } finally {
      setIsLoading(false);
    }
  };

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
        newImages.push({ file: processedFile, url, isMain: false, isUploading: false });
      } catch (error: any) {
        imageErrors.push(`Failed to process ${file.name}: ${error.message}`);
      }
    }

    setIsCompressing(false);
    setImages((prev) => [...prev, ...newImages]);

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
      if (removedImage.isMain && newImages.length > 0) newImages[0].isMain = true;
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
    if (!params?.id) {
      setSubmitError("Product ID is missing");
      return;
    }

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

    let totalStock = 0;
    let minPrice = Infinity;
    let pricingConfig: any = { mode: 'single' };
    const uniqueSizes = new Set<string>();
    const uniqueColors = new Set<string>();

    if (!hasVariants) {
      totalStock = data.stock;
      pricingConfig.singleStock = totalStock;
      minPrice = data.price;
    } else {
      if (hasSizes && hasColors) {
        pricingConfig.mode = 'combination';
        pricingConfig.combinationPrices = {};
        pricingConfig.combinationStock = {};
        
        variants.forEach(v => {
          const s = v.size.trim();
          if (s) uniqueSizes.add(s);
          v.colors.forEach(c => {
            const cn = c.name.trim();
            if (cn) uniqueColors.add(cn);
            if (s && cn) {
              const key = `${s}|${cn}`;
              pricingConfig.combinationPrices[key] = c.price;
              pricingConfig.combinationStock[key] = c.stock;
              totalStock += c.stock;
              if (c.price < minPrice) minPrice = c.price;
            }
          });
        });
      } else if (hasSizes && !hasColors) {
        pricingConfig.mode = 'size';
        pricingConfig.sizePrices = {};
        pricingConfig.sizeStock = {};
        
        variants.forEach(v => {
          const s = v.size.trim();
          if (s) {
            uniqueSizes.add(s);
            pricingConfig.sizePrices[s] = v.price;
            pricingConfig.sizeStock[s] = v.stock;
            totalStock += v.stock;
            if (v.price < minPrice) minPrice = v.price;
          }
        });
      } else if (!hasSizes && hasColors) {
        pricingConfig.mode = 'color';
        pricingConfig.colorPrices = {};
        pricingConfig.colorStock = {};
        
        variants.forEach(v => {
          v.colors.forEach(c => {
            const cn = c.name.trim();
            if (cn) {
              uniqueColors.add(cn);
              pricingConfig.colorPrices[cn] = c.price;
              pricingConfig.colorStock[cn] = c.stock;
              totalStock += c.stock;
              if (c.price < minPrice) minPrice = c.price;
            }
          });
        });
      }
    }

    if (hasVariants && hasColors && uniqueColors.size > 0) {
      if (images.length < uniqueColors.size) {
        setSubmitError(`Please upload at least ${uniqueColors.size} images (you have ${images.length}) to correspond with your ${uniqueColors.size} unique colors.`);
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSuccess(false);

    try {
      const uploadedImages: string[] = [];
      const colorImagesMap: Record<string, string> = {};

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
        
        if (image.assignedColor && !colorImagesMap[image.assignedColor]) {
          colorImagesMap[image.assignedColor] = imageUrl;
        }
      }

      if (Object.keys(colorImagesMap).length > 0) {
        pricingConfig.colorImages = colorImagesMap;
      }

      const mainImageIndex = images.findIndex((img) => img.isMain);
      const mainImageUrl = uploadedImages[mainImageIndex];
      const additionalImages = uploadedImages.filter((_, index) => index !== mainImageIndex);

      const productData = {
        id: params.id,
        name: data.name,
        description: data.description,
        price: minPrice === Infinity ? 0 : minPrice,
        category: data.category,
        sub_category: data.sub_category,
        main_image: mainImageUrl,
        images: additionalImages,
        colors: Array.from(uniqueColors),
        sizes: Array.from(uniqueSizes),
        sizing_type: sizingType,
        stock: totalStock,
        details: data.details?.map(d => d.value).filter((d) => d.trim() !== "") || [],
        pricing_config: pricingConfig
      };

      const response = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to update product");

      setSuccess(true);
      setTimeout(() => {
        router.push("/admin/products");
        router.refresh();
      }, 2000);
    } catch (error: any) {
      setSubmitError(error.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/admin/products" className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium mb-6 transition-colors bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100">
            <ArrowLeft size={20} />
            Back to Products
          </Link>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (submitError && !product) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Error Loading Product</h2>
          <p className="text-gray-600 mb-4">{submitError}</p>
          <p className="text-sm text-gray-500 mb-8">Product ID: {params?.id || "Not available"}</p>
          <div className="space-y-3">
            <Link href="/admin/products" className="block w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
              Back to Products
            </Link>
            <button onClick={() => params?.id && fetchProduct(params.id)} className="block w-full border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Successfully Updated!</h2>
          <p className="text-gray-600 mb-8">Your product has been updated. Redirecting back to products list...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
            <p className="text-gray-500 mt-1">Update your product's details and inventory.</p>
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
                    {...register("name", { onBlur: () => handleTitleCaseBlur("name") })}
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
              <div className="bg-gray-50 p-5 md:p-8 rounded-xl border border-gray-100 mb-8">
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Pricing & Variants</h3>
                    <p className="text-sm text-gray-500 mt-1">Configure pricing, stock, sizes, and colors.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200">
                    <label className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={hasVariants}
                        onChange={(e) => {
                          setHasVariants(e.target.checked);
                          if (!e.target.checked) {
                            setHasSizes(false);
                            setHasColors(false);
                          } else {
                            setHasSizes(true);
                            setHasColors(true);
                          }
                        }}
                      />
                      Product has multiple options
                    </label>
                  </div>
                </div>

                {!hasVariants ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-xl border border-gray-200">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Base Price (₦) <span className="text-red-500">*</span></label>
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
                      <label className="block text-sm font-bold text-gray-700 mb-2">Total Stock <span className="text-red-500">*</span></label>
                      <input
                        {...register("stock")}
                        type="number"
                        className={`w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black transition-colors ${errors.stock ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                        min="0" placeholder="0"
                      />
                      {errors.stock && <p className="text-red-500 text-sm mt-1.5">{errors.stock.message}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 p-4 bg-white rounded-lg border border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={hasSizes}
                          onChange={(e) => setHasSizes(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Has Sizes/Ages</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={hasColors}
                          onChange={(e) => setHasColors(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Has Colors</span>
                      </label>
                      {hasSizes && (
                        <div className="ml-auto flex items-center bg-gray-50 rounded-lg border border-gray-200 p-1">
                          <label className={`cursor-pointer px-3 py-1 rounded-md text-xs font-medium transition-colors ${sizingType === 'size' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <input type="radio" value="size" checked={sizingType === 'size'} onChange={() => setSizingType('size')} className="sr-only" /> Use Sizes (S, M, L)
                          </label>
                          <label className={`cursor-pointer px-3 py-1 rounded-md text-xs font-medium transition-colors ${sizingType === 'age' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <input type="radio" value="age" checked={sizingType === 'age'} onChange={() => setSizingType('age')} className="sr-only" /> Use Ages (3-6m)
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {variants.map((variant, vIdx) => (
                        <div key={vIdx} className="border border-blue-200 bg-blue-50/30 rounded-xl p-5 relative">
                          {variants.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => setVariants(variants.filter((_, i) => i !== vIdx))}
                              className="absolute right-4 top-4 text-red-400 hover:text-red-600 p-1"
                              title="Remove this group"
                            >
                              <X size={18} />
                            </button>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            {hasSizes && (
                              <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">
                                  {sizingType === 'age' ? 'Age Group' : 'Size'}
                                </label>
                                <input
                                  type="text"
                                  value={variant.size}
                                  onChange={(e) => {
                                    const newV = [...variants];
                                    newV[vIdx].size = e.target.value;
                                    setVariants(newV);
                                  }}
                                  onBlur={() => handleStateTitleCaseBlur(vIdx)}
                                  className="w-full border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                  placeholder={sizingType === 'age' ? "e.g., 3-6 Months" : "e.g., Medium"}
                                />
                              </div>
                            )}

                            {(!hasColors) && (
                              <>
                                <div className="md:col-span-1">
                                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Price (₦)</label>
                                  <input
                                    type="number"
                                    value={variant.price || ''}
                                    onChange={(e) => {
                                      const newV = [...variants];
                                      newV[vIdx].price = Number(e.target.value);
                                      setVariants(newV);
                                    }}
                                    className="w-full border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                    placeholder="Price"
                                  />
                                </div>
                                <div className="md:col-span-1">
                                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Stock Qty</label>
                                  <input
                                    type="number"
                                    value={variant.stock || ''}
                                    onChange={(e) => {
                                      const newV = [...variants];
                                      newV[vIdx].stock = Number(e.target.value);
                                      setVariants(newV);
                                    }}
                                    className="w-full border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                    placeholder="Qty"
                                  />
                                </div>
                              </>
                            )}
                          </div>

                          {hasColors && (
                            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-gray-700">Colors for {hasSizes ? (variant.size || 'this size') : 'this product'}</h4>
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    const newV = [...variants];
                                    newV[vIdx].colors.push({ name: '', price: 0, stock: 0 });
                                    setVariants(newV);
                                  }}
                                  className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1"
                                >
                                  <Plus size={14} /> Add Color
                                </button>
                              </div>
                              <div className="space-y-2">
                                {variant.colors.map((color, cIdx) => (
                                  <div key={cIdx} className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                                    <input
                                      type="text"
                                      value={color.name}
                                      onChange={(e) => {
                                        const newV = [...variants];
                                        newV[vIdx].colors[cIdx].name = e.target.value;
                                        setVariants(newV);
                                      }}
                                      onBlur={() => handleStateTitleCaseBlur(vIdx, cIdx)}
                                      className="flex-1 min-w-[120px] border-gray-300 rounded-lg px-3 py-1.5 text-sm text-black focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                      placeholder="Color Name"
                                    />
                                    <div className="relative w-28 sm:w-32">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₦</span>
                                      <input
                                        type="number"
                                        value={color.price || ''}
                                        onChange={(e) => {
                                          const newV = [...variants];
                                          newV[vIdx].colors[cIdx].price = Number(e.target.value);
                                          setVariants(newV);
                                        }}
                                        className="w-full border-gray-300 rounded-lg pl-6 pr-2 py-1.5 text-sm text-black focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                        placeholder="Price"
                                      />
                                    </div>
                                    <input
                                      type="number"
                                      value={color.stock || ''}
                                      onChange={(e) => {
                                        const newV = [...variants];
                                        newV[vIdx].colors[cIdx].stock = Number(e.target.value);
                                        setVariants(newV);
                                      }}
                                      className="w-20 sm:w-24 border-gray-300 rounded-lg px-2 py-1.5 text-sm text-black focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                      placeholder="Stock"
                                    />
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        const newV = [...variants];
                                        newV[vIdx].colors = newV[vIdx].colors.filter((_, i) => i !== cIdx);
                                        setVariants(newV);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-md transition-colors"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ))}
                                {variant.colors.length === 0 && (
                                  <p className="text-xs text-amber-600 italic py-2">No colors added. Click 'Add Color' above.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {hasSizes && (
                        <button 
                          type="button" 
                          onClick={() => setVariants([...variants, { size: "", price: 0, stock: 0, colors: [{ name: '', price: 0, stock: 0 }] }])}
                          className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus size={18} /> Add Another {sizingType === 'age' ? 'Age Group' : 'Size'}
                        </button>
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
                            {...register(`details.${index}.value`, { onBlur: () => handleTitleCaseBlur(`details.${index}.value`) })}
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

              <hr className="border-gray-100" />

              {/* Product Images Upload */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                  <div>
                    <label className="block text-sm font-bold text-gray-800">Product Images <span className="text-red-500">*</span></label>
                    <p className="text-xs text-gray-500 mt-0.5">Upload multiple. Click the star to set the main cover image.</p>
                    {uniqueColorsCount > 0 && images.length < uniqueColorsCount && (
                      <p className="text-xs font-bold text-amber-600 mt-1">
                        ⚠️ Please upload at least {uniqueColorsCount} image{uniqueColorsCount !== 1 ? 's' : ''} to show the different colors you entered.
                      </p>
                    )}
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
                          <div key={index} className="flex flex-col h-full justify-end gap-2">
                            <div className="relative group rounded-xl overflow-hidden shadow-sm w-full">
                              <div className={`absolute inset-0 border-4 rounded-xl z-10 pointer-events-none transition-colors ${image.isMain ? 'border-blue-500' : 'border-transparent'}`}></div>
                              <img
                                src={image.url}
                                alt={`Product image ${index + 1}`}
                                className="w-full h-auto block rounded-xl"
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
                            {uniqueColorsArray.length > 0 && (
                              <select
                                value={image.assignedColor || ""}
                                onChange={(e) => {
                                  const newImages = [...images];
                                  newImages[index].assignedColor = e.target.value;
                                  setImages(newImages);
                                }}
                                className={`w-full text-xs py-2 px-2 rounded-lg border-2 transition-colors focus:ring-2 focus:outline-none focus:ring-blue-500 ${image.assignedColor ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold' : 'border-gray-200 bg-white text-gray-700 font-medium'}`}
                              >
                                <option value="">No Color Assigned</option>
                                {uniqueColorsArray.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                        <label htmlFor="image-upload" className="self-end w-full flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors group">
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
                      Updating Product...
                    </>
                  ) : isCompressing ? (
                    "Processing Images..."
                  ) : images.length === 0 ? (
                    "Add Images to Continue"
                  ) : (
                    "Save Changes"
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