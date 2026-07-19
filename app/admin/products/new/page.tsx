/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/products/new/page.tsx - ADD NEW PRODUCT
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { useProductForm, useProductVariants, useProductImages, useProductCategories, useProductSubmit } from '../hooks';
import { ProductFormShell, ProductInfoSection, PricingVariantsEditor, ProductDetailsEditor, ProductImageUploader } from '../components';

export default function AddProductPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    detailFields,
    appendDetail,
    removeDetail,
    handleTitleCaseBlur,
    selectedCategorySlug,
  } = useProductForm();

  const { categories, loadingCategories } = useProductCategories();
  const selectedCategory = categories.find((c) => c.slug === selectedCategorySlug);

  const variantsApi = useProductVariants();
  const { hasVariants, hasSizes, hasColors, sizingType, variants, uniqueColorsArray, uniqueColorsCount } = variantsApi;

  const { images, setImages, fileInputRef, isCompressing, handleImageChange, removeImage, setAsMainImage, assignImageColor, uploadAllForSubmit } =
    useProductImages({
      autoMainOnFirst: true,
      onUploadStart: () => {
        setSubmitError('');
        setSuccess(false);
      },
      onUploadErrors: (message) => {
        setSubmitError(message);
        setTimeout(() => setSubmitError(''), 5000);
      },
    });

  const { onSubmit, isSubmitting, submitError, setSubmitError, success, setSuccess } = useProductSubmit({
    hasVariants,
    hasSizes,
    hasColors,
    variants,
    sizingType,
    images,
    isCompressing,
    uploadAllForSubmit,
  });

  return (
    <ProductFormShell
      title="Add New Product"
      subtitle="Fill out the details to add a new product to your inventory."
      submitError={submitError}
      success={success}
      successTitle="Success!"
      successMessage="Your product has been beautifully added to the store."
      successActions={
        <div className="space-y-4">
          <Link
            href="/admin/products"
            className="block w-full bg-primary text-primary-foreground py-3 rounded-control font-semibold hover:bg-primary-hover transition-colors text-center shadow-elevation-2"
          >
            View All Products
          </Link>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              reset();
              setImages([]);
              setSubmitError('');
              setSuccess(false);
            }}
            className="w-full font-semibold"
          >
            Add Another Product
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-8">
        <ProductInfoSection
          register={register}
          errors={errors}
          handleTitleCaseBlur={handleTitleCaseBlur}
          categories={categories}
          loadingCategories={loadingCategories}
          selectedCategory={selectedCategory}
        />

        <hr className="border-border-light" />

        <PricingVariantsEditor register={register} errors={errors} {...variantsApi} />

        <ProductDetailsEditor
          register={register}
          detailFields={detailFields}
          appendDetail={appendDetail}
          removeDetail={removeDetail}
          handleTitleCaseBlur={handleTitleCaseBlur}
        />

        <hr className="border-border-light" />

        <ProductImageUploader
          images={images}
          fileInputRef={fileInputRef}
          isCompressing={isCompressing}
          uniqueColorsArray={uniqueColorsArray}
          uniqueColorsCount={uniqueColorsCount}
          onImageChange={handleImageChange}
          onRemoveImage={removeImage}
          onSetAsMainImage={setAsMainImage}
          onAssignImageColor={assignImageColor}
        />

        <div className="pt-6">
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || isCompressing || images.length === 0}
            loading={isSubmitting}
            className="w-full font-bold text-body-lg shadow-elevation-2 hover:shadow-elevation-3"
          >
            {isSubmitting
              ? 'Creating Product...'
              : isCompressing
                ? 'Processing Images...'
                : images.length === 0
                  ? 'Add Images to Continue'
                  : 'Publish Product'}
          </Button>
        </div>
      </form>
    </ProductFormShell>
  );
}
