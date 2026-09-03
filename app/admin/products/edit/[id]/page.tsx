/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/products/edit/[id]/page.tsx - EDIT PRODUCT
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useProductForm, useProductVariants, useProductImages, useProductCategories, useProductSubmit, useEditProductData } from '../../hooks';
import { ProductFormShell, ProductInfoSection, PricingVariantsEditor, ProductFitSection, ProductDetailsEditor, ProductImageUploader } from '../../components';
import EntityHistory from '@/app/admin/components/EntityHistory';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function EditProductPage(props: PageProps) {
  const params = use(props.params);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
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
  const {
    hasVariants, hasSizes, hasColors, sizingType, variants,
    setHasVariants, setHasSizes, setHasColors, setSizingType, setVariants,
    uniqueColorsArray, uniqueColorsCount,
  } = variantsApi;

  const { images, setImages, fileInputRef, isCompressing, handleImageChange, removeImage, setAsMainImage, assignImageColor, uploadAllForSubmit } =
    useProductImages({
      autoMainOnFirst: false,
      onUploadStart: () => {
        setSubmitError('');
        setSuccess(false);
      },
      onUploadErrors: (message) => {
        setSubmitError(message);
        setTimeout(() => setSubmitError(''), 5000);
      },
    });

  const { product, isLoading, loadError, refetch } = useEditProductData({
    productId: params.id,
    reset,
    setImages,
    setHasVariants,
    setHasSizes,
    setHasColors,
    setSizingType,
    setVariants,
  });

  const { onSubmit, isSubmitting, submitError, setSubmitError, success, setSuccess } = useProductSubmit({
    productId: params.id,
    hasVariants,
    hasSizes,
    hasColors,
    variants,
    sizingType,
    images,
    isCompressing,
    uploadAllForSubmit,
    onSuccess: () => {
      setTimeout(() => {
        router.push('/admin/products');
        router.refresh();
      }, 2000);
    },
  });

  return (
    <ProductFormShell
      title="Edit Product"
      subtitle="Update your product's details and inventory."
      isLoading={isLoading}
      loadError={!product ? loadError : ''}
      loadErrorContext={`Product ID: ${params?.id || 'Not available'}`}
      onRetryLoad={() => params?.id && refetch()}
      submitError={submitError}
      success={success}
      successTitle="Successfully Updated!"
      successMessage="Your product has been updated. Redirecting back to products list..."
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

        <PricingVariantsEditor register={register} errors={errors} watch={watch} {...variantsApi} />

        <ProductFitSection register={register} />

        <hr className="border-border-light" />

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
              ? 'Updating Product...'
              : isCompressing
                ? 'Processing Images...'
                : images.length === 0
                  ? 'Add Images to Continue'
                  : 'Save Changes'}
          </Button>
        </div>
      </form>

      {/* Outside the form: what has changed on this product, and who changed
          it. "The price is wrong — what was it before?" is answerable here. */}
      <div className="mt-8">
        <EntityHistory entityType="product" entityId={params.id} pageSize={10} />
      </div>
    </ProductFormShell>
  );
}
