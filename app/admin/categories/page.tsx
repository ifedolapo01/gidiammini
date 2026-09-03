/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
'use client';
import { CategoriesSkeleton } from './components/CategoriesSkeleton';

import { useCategories } from './hooks/useCategories';
import { AddCategoryForm } from './components/AddCategoryForm';
import { AddSubcategoryForm } from './components/AddSubcategoryForm';
import { CategoryList } from './components/CategoryList';

export default function CategoriesPage() {
  const {
    categories,
    loading,
    error,
    newCatName,
    newCatSlug,
    setNewCatSlug,
    isAddingCat,
    selectedCategoryForSub,
    newSubName,
    newSubSlug,
    isAddingSub,
    pendingDeleteId,
    savingGuidanceId,
    handleCatNameChange,
    handleSubNameChange,
    handleParentCategoryChange,
    handleAddCategory,
    handleDeleteCategory,
    handleAddSubcategory,
    handleDeleteSubcategory,
    handleSaveGuidance,
  } = useCategories();

  if (loading && categories.length === 0) return <CategoriesSkeleton />;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-h4 font-bold text-text-primary">Manage Categories</h1>
          <p className="text-text-secondary">Add, edit, or remove product categories and subcategories.</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive-background text-destructive p-4 rounded-control mb-6 border border-destructive-border">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Forms Section */}
        <div className="lg:col-span-1 space-y-6">
          <AddCategoryForm
            newCatName={newCatName}
            newCatSlug={newCatSlug}
            isAddingCat={isAddingCat}
            onNameChange={handleCatNameChange}
            onSlugChange={(e) => setNewCatSlug(e.target.value)}
            onSubmit={handleAddCategory}
          />

          <AddSubcategoryForm
            categories={categories}
            selectedCategoryForSub={selectedCategoryForSub}
            newSubName={newSubName}
            newSubSlug={newSubSlug}
            isAddingSub={isAddingSub}
            onParentChange={handleParentCategoryChange}
            onNameChange={handleSubNameChange}
            onSubmit={handleAddSubcategory}
          />
        </div>

        {/* Categories List Section */}
        <div className="lg:col-span-2">
          <CategoryList
            categories={categories}
            pendingDeleteId={pendingDeleteId}
            savingGuidanceId={savingGuidanceId}
            onDeleteCategory={handleDeleteCategory}
            onDeleteSubcategory={handleDeleteSubcategory}
            onSaveGuidance={handleSaveGuidance}
          />
        </div>

      </div>
    </div>
  );
}
