/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/products/new/page.tsx - ADD NEW PRODUCT
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Upload, X, ArrowLeft, Star, Plus } from "lucide-react";
import Link from "next/link";
import { Button, Input, Textarea, Spinner } from "@/components/ui";
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
  singleSize: z.string().optional(),
  singleColor: z.string().optional(),
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

export default function AddProductPage() {
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
      singleSize: "",
      singleColor: "",
      stock: 0,
      colors: [{ value: "" }],
      sizes: [{ value: "" }],
      sizing_type: "size",
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

  const [images, setImages] = useState<ImageFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

    let totalStock = 0;
    let minPrice = Infinity;
    let pricingConfig: any = { mode: 'single' };
    const uniqueSizes = new Set<string>();
    const uniqueColors = new Set<string>();

    if (!hasVariants) {
      totalStock = data.stock;
      pricingConfig.singleStock = totalStock;
      if (data.singleSize) pricingConfig.singleSize = data.singleSize;
      if (data.singleColor) pricingConfig.singleColor = data.singleColor;
      if (data.singleSize) uniqueSizes.add(data.singleSize);
      if (data.singleColor) uniqueColors.add(data.singleColor);
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-background-secondary">
        <div className="bg-surface border border-border rounded-surface shadow-elevation-4 p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-success-background rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-h3 font-bold text-text-primary mb-3">Success!</h2>
          <p className="text-text-secondary mb-8">Your product has been beautifully added to the store.</p>
          <div className="space-y-4">
            <Link href="/admin/products" className="block w-full bg-primary text-primary-foreground py-3 rounded-control font-semibold hover:bg-primary-hover transition-colors text-center shadow-elevation-2">
              View All Products
            </Link>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                reset();
                setImages([]);
                setSubmitError("");
                setSuccess(false);
              }}
              className="w-full font-semibold"
            >
              Add Another Product
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-secondary p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin/products" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary font-medium mb-6 transition-colors bg-surface px-4 py-2 rounded-control shadow-elevation-1 border border-border-light">
          <ArrowLeft size={20} />
          Back to Products
        </Link>

        <div className="bg-surface rounded-surface shadow-elevation-3 border border-border-light overflow-hidden">
          <div className="border-b border-border-light bg-background-secondary/50 px-8 py-6">
            <h1 className="text-h3 font-bold text-text-primary">Add New Product</h1>
            <p className="text-text-secondary mt-1">Fill out the details to add a new product to your inventory.</p>
          </div>

          <div className="p-8">
            {submitError && (
              <div className="mb-8 p-4 bg-destructive-background border border-destructive-border rounded-surface flex items-start gap-3">
                <div className="bg-destructive/10 p-1.5 rounded-full mt-0.5">
                  <X size={16} className="text-destructive" />
                </div>
                <p className="text-destructive font-medium whitespace-pre-line leading-relaxed">{submitError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-8">
              {/* Product Info Section */}
              <div className="space-y-6">
                <div>
                  <label className="block text-body-sm font-bold text-text-primary mb-2">Product Name <span className="text-destructive">*</span></label>
                  <Input
                    {...register("name", { onBlur: () => handleTitleCaseBlur("name") })}
                    type="text"
                    invalid={!!errors.name}
                    placeholder="e.g., Premium Cotton Tee"
                  />
                  {errors.name && <p className="text-destructive text-body-sm mt-1.5">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-body-sm font-bold text-text-primary mb-2">Description</label>
                  <Textarea
                    {...register("description")}
                    invalid={!!errors.description}
                    className="h-32"
                    placeholder="Describe your product beautifully..."
                  />
                  {errors.description && <p className="text-destructive text-body-sm mt-1.5">{errors.description.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-body-sm font-bold text-text-primary mb-2">Category <span className="text-destructive">*</span></label>
                    <select
                      {...register("category")}
                      className={`w-full h-11 rounded-control border px-3 text-text-primary bg-surface transition-colors ${errors.category ? 'border-destructive' : 'border-border'}`}
                      disabled={loadingCategories}
                    >
                      <option value="">Select a category...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.slug}>{cat.name}</option>
                      ))}
                    </select>
                    {errors.category && <p className="text-destructive text-body-sm mt-1.5">{errors.category.message}</p>}
                  </div>

                  {selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
                    <div>
                      <label className="block text-body-sm font-bold text-text-primary mb-2">Subcategory</label>
                      <select
                        {...register("sub_category")}
                        className="w-full h-11 rounded-control border border-border px-3 text-text-primary bg-surface transition-colors"
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

              <hr className="border-divider" />

              {/* Dynamic Fields Section */}
              {/* Dynamic Fields Section */}
              <div className="bg-background-secondary p-5 md:p-8 rounded-surface border border-border-light mb-8">
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-body-lg font-bold text-text-primary">Pricing & Variants</h3>
                    <p className="text-body-sm text-text-secondary mt-1">Configure pricing, stock, sizes and colors.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-control border border-border">
                    <label className="text-body-sm font-medium text-text-primary cursor-pointer flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded-control border-border-strong accent-primary"
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-surface rounded-surface border border-border">
                    <div>
                      <label className="block text-body-sm font-bold text-text-primary mb-2">Base Price (₦) <span className="text-destructive">*</span></label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary font-medium">₦</span>
                        <Input
                          {...register("price")}
                          type="number" onFocus={(e) => e.target.select()}
                          invalid={!!errors.price}
                          className="pl-8"
                          min="0" step="100" placeholder="0"
                        />
                      </div>
                      {errors.price && <p className="text-destructive text-body-sm mt-1.5">{errors.price.message}</p>}
                    </div>
                    <div>
                      <label className="block text-body-sm font-bold text-text-primary mb-2">Total Stock <span className="text-destructive">*</span></label>
                      <Input
                        {...register("stock")}
                        type="number" onFocus={(e) => e.target.select()}
                        invalid={!!errors.stock}
                        min="0" placeholder="0"
                      />
                      {errors.stock && <p className="text-destructive text-body-sm mt-1.5">{errors.stock.message}</p>}
                    </div>
                    <div>
                      <label className="block text-body-sm font-bold text-text-primary mb-2">Size/Age (Optional)</label>
                      <Input
                        {...register("singleSize")}
                        type="text"
                        placeholder="e.g., XL, 2-3 Years"
                      />
                    </div>
                    <div>
                      <label className="block text-body-sm font-bold text-text-primary mb-2">Color (Optional)</label>
                      <Input
                        {...register("singleColor")}
                        type="text"
                        placeholder="e.g., Red, Blue"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 p-4 bg-surface rounded-control border border-border">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasSizes}
                          onChange={(e) => setHasSizes(e.target.checked)}
                          className="rounded-control border-border-strong accent-primary w-4 h-4"
                        />
                        <span className="text-body-sm font-medium text-text-primary">Has Sizes/Ages</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasColors}
                          onChange={(e) => setHasColors(e.target.checked)}
                          className="rounded-control border-border-strong accent-primary w-4 h-4"
                        />
                        <span className="text-body-sm font-medium text-text-primary">Has Colors</span>
                      </label>
                      {hasSizes && (
                        <div className="ml-auto flex items-center bg-background-secondary rounded-control border border-border p-1">
                          <label className={`cursor-pointer px-3 py-1 rounded-control text-caption-md font-medium transition-colors ${sizingType === 'size' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-background-tertiary'}`}>
                            <input type="radio" value="size" checked={sizingType === 'size'} onChange={() => setSizingType('size')} className="sr-only" /> Use Sizes (S, M, L)
                          </label>
                          <label className={`cursor-pointer px-3 py-1 rounded-control text-caption-md font-medium transition-colors ${sizingType === 'age' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-background-tertiary'}`}>
                            <input type="radio" value="age" checked={sizingType === 'age'} onChange={() => setSizingType('age')} className="sr-only" /> Use Ages (3-6m)
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {variants.map((variant, vIdx) => (
                        <div key={vIdx} className="border border-accent/30 bg-accent/5 rounded-surface p-5 relative">
                          {variants.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => setVariants(variants.filter((_, i) => i !== vIdx))}
                              className="absolute right-4 top-4 text-destructive/70 hover:text-destructive p-1"
                              title="Remove this group"
                            >
                              <X size={18} />
                            </button>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            {hasSizes && (
                              <div className="md:col-span-1">
                                <label className="block text-caption-md font-bold text-text-secondary uppercase tracking-wider mb-1">
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
                                  className="w-full border-border rounded-control px-3 py-2 text-body-sm text-text-primary focus-visible:border-focus bg-surface"
                                  placeholder={sizingType === 'age' ? "e.g., 3-6 Months" : "e.g., Medium"}
                                />
                              </div>
                            )}

                            {(!hasColors) && (
                              <>
                                <div className="md:col-span-1">
                                  <label className="block text-caption-md font-bold text-text-secondary uppercase tracking-wider mb-1">Price (₦)</label>
                                  <input
                                    type="number" onFocus={(e) => e.target.select()}
                                    value={variant.price || ''}
                                    onChange={(e) => {
                                      const newV = [...variants];
                                      newV[vIdx].price = Number(e.target.value);
                                      setVariants(newV);
                                    }}
                                    className="w-full border-border rounded-control px-3 py-2 text-body-sm text-text-primary focus-visible:border-focus bg-surface"
                                    placeholder="Price"
                                  />
                                </div>
                                <div className="md:col-span-1">
                                  <label className="block text-caption-md font-bold text-text-secondary uppercase tracking-wider mb-1">Stock Qty</label>
                                  <input
                                    type="number" onFocus={(e) => e.target.select()}
                                    value={variant.stock || ''}
                                    onChange={(e) => {
                                      const newV = [...variants];
                                      newV[vIdx].stock = Number(e.target.value);
                                      setVariants(newV);
                                    }}
                                    className="w-full border-border rounded-control px-3 py-2 text-body-sm text-text-primary focus-visible:border-focus bg-surface"
                                    placeholder="Qty"
                                  />
                                </div>
                              </>
                            )}
                          </div>

                          {hasColors && (
                            <div className="bg-surface rounded-control border border-border p-4 shadow-elevation-1">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-body-sm font-semibold text-text-primary">Colors for {hasSizes ? (variant.size || 'this size') : 'this product'}</h4>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newV = [...variants];
                                    newV[vIdx].colors.push({ name: '', price: 0, stock: 0 });
                                    setVariants(newV);
                                  }}
                                  className="text-caption-md font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-control hover:bg-primary/20 transition-colors flex items-center gap-1"
                                >
                                  <Plus size={14} /> Add Color
                                </button>
                              </div>
                              <div className="space-y-2">
                                {variant.colors.map((color, cIdx) => (
                                  <div key={cIdx} className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-background-secondary/50 p-2 rounded-control border border-border-light">
                                    <input
                                      type="text"
                                      value={color.name}
                                      onChange={(e) => {
                                        const newV = [...variants];
                                        newV[vIdx].colors[cIdx].name = e.target.value;
                                        setVariants(newV);
                                      }}
                                      onBlur={() => handleStateTitleCaseBlur(vIdx, cIdx)}
                                      className="flex-1 min-w-[120px] border-border rounded-control px-3 py-1.5 text-body-sm text-text-primary focus-visible:border-focus bg-surface"
                                      placeholder="Color Name"
                                    />
                                    <div className="relative w-28 sm:w-32">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary text-caption-md">₦</span>
                                      <input
                                        type="number" onFocus={(e) => e.target.select()}
                                        value={color.price || ''}
                                        onChange={(e) => {
                                          const newV = [...variants];
                                          newV[vIdx].colors[cIdx].price = Number(e.target.value);
                                          setVariants(newV);
                                        }}
                                        className="w-full border-border rounded-control pl-6 pr-2 py-1.5 text-body-sm text-text-primary focus-visible:border-focus bg-surface"
                                        placeholder="Price"
                                      />
                                    </div>
                                    <input
                                      type="number" onFocus={(e) => e.target.select()}
                                      value={color.stock || ''}
                                      onChange={(e) => {
                                        const newV = [...variants];
                                        newV[vIdx].colors[cIdx].stock = Number(e.target.value);
                                        setVariants(newV);
                                      }}
                                      className="w-20 sm:w-24 border-border rounded-control px-2 py-1.5 text-body-sm text-text-primary focus-visible:border-focus bg-surface"
                                      placeholder="Stock"
                                    />
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        const newV = [...variants];
                                        newV[vIdx].colors = newV[vIdx].colors.filter((_, i) => i !== cIdx);
                                        setVariants(newV);
                                      }}
                                      className="p-1.5 text-text-muted hover:text-destructive rounded-control transition-colors"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ))}
                                {variant.colors.length === 0 && (
                                  <p className="text-caption-md text-warning italic py-2">No colors added. Click 'Add Color' above.</p>
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
                          className="w-full py-3 border-2 border-dashed border-border-strong text-text-secondary hover:text-primary hover:border-primary/40 hover:bg-primary/10 rounded-surface font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus size={18} /> Add Another {sizingType === 'age' ? 'Age Group' : 'Size'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

                {/* Details */}

                <div className="bg-background-secondary p-5 rounded-surface border border-border-light md:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <label className="block text-body-sm font-bold text-text-primary">Features & Details</label>
                      <p className="text-caption-md text-text-secondary mt-0.5">These will appear as bullet points on the product page.</p>
                    </div>
                    <button type="button" onClick={() => appendDetail({ value: "" })} className="text-caption-md font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-control hover:bg-primary/20 transition-colors">+ Add Detail</button>
                  </div>
                  <div className="space-y-3">
                    {detailFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <div className="mt-3 w-1.5 h-1.5 rounded-full bg-text-muted shrink-0"></div>
                        <div className="flex-1">
                          <input
                            {...register(`details.${index}.value`)}
                            className="w-full border border-border-light rounded-control px-3 py-2 text-text-primary"
                            placeholder="e.g., 100% Organic Cotton"
                          />
                        </div>
                        <button type="button" onClick={() => removeDetail(index)} className="p-2 text-text-muted hover:text-destructive hover:bg-destructive-background rounded-control transition-colors"><X size={20} /></button>
                      </div>
                    ))}
                    {detailFields.length === 0 && (
                      <p className="text-body-sm text-text-muted italic">No features added. Click '+ Add Detail' to include some.</p>
                    )}
                  </div>
                </div>

              <hr className="border-border-light" />

              {/* Product Images Upload */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                  <div>
                    <label className="block text-body-sm font-bold text-text-primary">Product Images <span className="text-destructive">*</span></label>
                    <p className="text-caption-md text-text-secondary mt-0.5">Upload multiple. Click the star to set the main cover image.</p>
                    {uniqueColorsCount > 0 && images.length < uniqueColorsCount && (
                      <p className="text-caption-md font-bold text-warning mt-1">
                        ⚠️ Please upload at least {uniqueColorsCount} image{uniqueColorsCount !== 1 ? 's' : ''} to show the different colors you entered.
                      </p>
                    )}
                  </div>
                  <span className="text-caption-md font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-control border border-primary/20">
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

                <div className={`border-2 border-dashed rounded-surface p-8 transition-colors ${images.length === 0 ? 'border-border-strong bg-background-secondary hover:bg-background-tertiary' : 'border-border'}`}>
                  {images.length === 0 ? (
                    <div className="text-center">
                      <div className="w-16 h-16 bg-surface border border-border rounded-surface flex items-center justify-center mx-auto mb-4 shadow-elevation-1">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-text-primary font-medium mb-1">Click to upload product images</p>
                      <p className="text-caption-md text-text-secondary mb-6">PNG, JPG, WEBP up to 10MB (auto-compressed)</p>
                      <label
                        htmlFor="image-upload"
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-control font-semibold hover:bg-primary-hover cursor-pointer shadow-elevation-1 transition-all"
                      >
                        <Plus size={18} /> Add Images
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {images.map((image, index) => (
                          <div key={index} className="flex flex-col h-full justify-end gap-2">
                            <div className="relative group rounded-surface overflow-hidden shadow-elevation-1 w-full">
                              <div className={`absolute inset-0 border-4 rounded-surface z-10 pointer-events-none transition-colors ${image.isMain ? 'border-primary' : 'border-transparent'}`}></div>
                              <img
                                src={image.url}
                                alt={`Product image ${index + 1}`}
                                className="w-full h-auto block rounded-surface"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Error'; }}
                              />
                              {image.isMain && (
                                <div className="absolute top-2 left-2 z-20 bg-primary text-primary-foreground p-1.5 rounded-control shadow-elevation-1">
                                  <Star size={14} fill="white" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-overlay opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center gap-2">
                                {!image.isMain && (
                                  <button type="button" onClick={() => setAsMainImage(index)} className="bg-surface p-2 rounded-control hover:bg-primary/10 hover:text-primary transition-colors" title="Set as main image">
                                    <Star size={18} />
                                  </button>
                                )}
                                <button type="button" onClick={() => removeImage(index)} className="bg-surface p-2 rounded-control hover:bg-destructive-background hover:text-destructive transition-colors" title="Remove image">
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
                                className={`w-full text-caption-md py-2 px-2 rounded-control border-2 transition-colors focus-visible:border-focus ${image.assignedColor ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border bg-surface text-text-primary font-medium'}`}
                              >
                                <option value="">No Color Assigned</option>
                                {uniqueColorsArray.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                        <label htmlFor="image-upload" className="self-end w-full flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border-strong rounded-surface cursor-pointer hover:bg-surface-hover hover:border-primary/50 transition-colors group">
                          <div className="w-10 h-10 bg-surface rounded-full flex items-center justify-center border border-border group-hover:border-primary/30 group-hover:text-primary mb-2 shadow-elevation-1">
                            <Plus size={20} />
                          </div>
                          <span className="text-caption-md font-medium text-text-secondary group-hover:text-primary">Add More</span>
                        </label>
                      </div>
                      {isCompressing && (
                        <div className="flex items-center justify-center gap-2 text-primary bg-primary/10 py-3 rounded-control border border-primary/20">
                          <Spinner size="sm" className="text-primary" />
                          <span className="text-body-sm font-medium">Optimizing images...</span>
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
                  className="w-full bg-primary text-primary-foreground py-4 rounded-control font-bold text-body-lg hover:bg-primary-hover disabled:bg-disabled disabled:text-text-muted disabled:cursor-not-allowed transition-all shadow-elevation-2 hover:shadow-elevation-3 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" className="text-primary-foreground" />
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
