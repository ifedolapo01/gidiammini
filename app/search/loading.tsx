/** STOREFRONT layer — GidiamMini branding. What /search shows while the server is still querying. */
// Re-export, not a second skeleton: /search now renders through the exact same
// ProductsBrowser shell /products does, so it waits behind the exact same
// shape — see ProductsListingSkeleton's own note on why a loading.tsx here
// would otherwise wrap /search/[anything] too, which does not exist, so unlike
// /products this file is safe to keep as a plain loading.tsx.
export { default } from '../products/components/ProductsListingSkeleton';
