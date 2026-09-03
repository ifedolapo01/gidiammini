/**
 * STOREFRONT layer — shapes shared by the listing's components.
 *
 * They used to be exported from useProductsListing, which meant a presentational
 * component had to import a hook to name its own props. The listing is
 * server-rendered now and there is no such hook to hang them on.
 */

export interface CategoryWithSubcategories {
  name: string;
  slug: string;
  subcategories?: { name: string; slug: string }[];
}

/** Which facet values exist within the current category scope. */
export interface FacetOptions {
  sizes: string[];
  colors: string[];
  minPrice: number;
  maxPrice: number;
}
