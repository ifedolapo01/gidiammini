/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The product page's server half: fetch, describe, and emit structured data.
//
// This was a client component that rendered a spinner and then fetched the
// product in an effect. Every product therefore shipped the root layout's one
// title and one description — the whole catalogue was a single page as far as
// search and social were concerned, and a link shared to WhatsApp showed a
// generic card instead of the item.
//
// Now the product is loaded here, before the response is sent.
// generateMetadata and the render share one query (loadProductDetail is
// request-cached), so this costs no extra round trip, and it removes the
// client-side one that used to sit in front of first paint.
//
// Do not add a loading.tsx to this route. Its Suspense boundary makes Next
// stream the response, which flushes 200 headers before this function runs —
// notFound() below then renders the right page under the wrong status, and a
// crawler keeps every delisted product in its index. Measured: with a
// loading.tsx an unknown id answered 200, without one it answers 404. The
// read is a cached server query, so there is little left to stream past.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import JsonLd from '@/components/JsonLd';
import { loadProductDetail } from '@/lib/commerce/product-detail-query';
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  productBreadcrumbTrail,
} from '@/lib/commerce/product-jsonld';
import { productImageUrls, productMetaDescription } from '@/lib/commerce/product-seo';
import { loadProductReviews } from '@/lib/commerce/review-query';
import { loadProductQuestions } from '@/lib/commerce/question-query';
import { absoluteUrl } from '@/lib/site-url';
import ProductDetailView from './components/ProductDetailView';
import ProductReviews from './components/reviews/ProductReviews';
import ProductQuestions from './components/questions/ProductQuestions';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await loadProductDetail(id);

  // Next discards this and renders not-found.tsx's own head once the page
  // calls notFound(), so the title here is a fallback rather than the thing a
  // crawler sees. The guard still has to exist: there is no product to
  // describe, and the noindex is the belt to that braces.
  if (!detail) {
    return { title: 'Product not found', robots: { index: false, follow: true } };
  }

  const { product } = detail;
  const description = productMetaDescription(product);
  const path = `/products/${product.id}`;
  const url = absoluteUrl(path);
  const images = productImageUrls(product);

  return {
    title: product.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      url,
      siteName: 'GidiamMini',
      images: images.map((image) => ({ url: image, alt: product.name })),
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description,
      images,
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  const detail = await loadProductDetail(id);

  // notFound() rather than an inline "not found" panel, so the response
  // actually carries a 404 and a crawler stops asking for the URL.
  if (!detail) notFound();

  const { product, discounts, categoryName, categorySizeGuidance } = detail;
  const url = absoluteUrl(`/products/${product.id}`);

  // Loaded once, used three times: the aggregateRating in the graph, the star
  // line under the product name, and the section itself. Calling the loader
  // from each would be three cache reads of the same thing.
  //
  // The questions come alongside rather than after — neither read depends on
  // the other, and both are cached under the same tag.
  const [reviewData, questionData] = await Promise.all([
    loadProductReviews(product.id),
    loadProductQuestions(product.id),
  ]);

  return (
    <>
      <JsonLd
        data={[
          // The stars a search listing shows come from here. They are the whole
          // SEO half of the reviews argument — the other half is the review
          // text, which is in the section below rather than in this graph.
          buildProductJsonLd(product, discounts, url, undefined, reviewData),
          buildBreadcrumbJsonLd(productBreadcrumbTrail(product, categoryName)),
        ]}
      />
      <ProductDetailView
        product={product}
        discounts={discounts}
        reviewStats={reviewData.stats}
        categorySizeGuidance={categorySizeGuidance}
        // A server component handed to a client one as a prop: the reviews are
        // rendered on the server (so they are in the HTML) but sit inside a
        // layout the client component owns.
        reviews={<ProductReviews data={reviewData} productName={product.name} />}
        // The other half of the trust story: reviews are evidence from people
        // who bought, this is the doubt of the person who has not yet.
        questions={<ProductQuestions productId={product.id} data={questionData} />}
      />
    </>
  );
}
