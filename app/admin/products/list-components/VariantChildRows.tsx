/** ADMIN layer — child-row renderers (combination / simple variants) for the products list table.
 *
 * Every row starts with an empty cell under the selection column: bulk actions
 * apply to products, not to individual variants, so a variant row has no
 * checkbox of its own but still has to line up with the header. */
import { Fragment } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui';
import { capitalizeText } from '@/lib/commerce/format-text';
import { formatCurrency } from '@/lib/commerce/pricing';
import { StockBadge } from '@/components/commerce/StockBadge';
import { hasCombination, groupBySize, type SizeGroupedVariant } from '@/lib/commerce/group-variants';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';

function variantImageCount(product: FlattenedProduct & { extractedColor?: string }) {
  return product.extractedColor
    ? (product.colorImages?.[product.extractedColor] ? 1 : 0)
    : (product.colorImages?.[product.variantKey] ? 1 : 0);
}

function CombinationSingleRow({ product }: { product: SizeGroupedVariant }) {
  return (
    <tr className="hover:bg-primary/10 transition-colors border-l-[8px] border-primary/60 bg-surface">
      <td className="px-4 py-3 w-10" />
      <td className="px-6 py-3 whitespace-nowrap pl-12 text-body-sm font-bold text-text-primary text-center">
        Size: {product.extractedSize}
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        <Badge tone="primary" className="font-bold">
          Color: {capitalizeText(product.extractedColor)}
        </Badge>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-text-primary text-center">
        {formatCurrency(product.price)}
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
        <StockBadge stock={product.stock} hideWhenInStock={false} countFormat="units" className="font-bold" />
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
        <div className="flex items-center justify-center gap-1">
          <ImageIcon size={16} className="text-text-muted" />
          <span className="text-text-secondary">{variantImageCount(product)}</span>
        </div>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
    </tr>
  );
}

function CombinationGroupRows({ size, sizeVariants }: { size: string; sizeVariants: SizeGroupedVariant[] }) {
  return (
    <>
      <tr className="bg-accent/5 border-l-4 border-accent/30">
        <td className="px-4 py-2 w-10" />
        <td className="px-6 py-2 whitespace-nowrap pl-12 text-body-sm font-bold text-text-primary text-center">
          Size: {size}
        </td>
        <td colSpan={6}></td>
      </tr>
      {sizeVariants.map(product => (
        <tr key={product.id} className="hover:bg-primary/10 transition-colors border-l-[12px] border-primary/60 bg-surface">
          <td className="px-4 py-3 w-10" />
          <td className="px-6 py-3 whitespace-nowrap text-center"></td>
          <td className="px-6 py-3 whitespace-nowrap pl-8 text-center">
            <Badge tone="primary" className="font-bold">
              Color: {capitalizeText(product.extractedColor)}
            </Badge>
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-center"></td>
          <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-text-primary text-center">
            {formatCurrency(product.price)}
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
            <StockBadge stock={product.stock} hideWhenInStock={false} countFormat="units" className="font-bold" />
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
            <div className="flex items-center justify-center gap-1">
              <ImageIcon size={16} className="text-text-muted" />
              <span className="text-text-secondary">{variantImageCount(product)}</span>
            </div>
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-center"></td>
        </tr>
      ))}
    </>
  );
}

function SimpleVariantRow({ product }: { product: FlattenedProduct }) {
  return (
    <tr className="hover:bg-primary/10 transition-colors border-l-4 border-primary/60 bg-surface">
      <td className="px-4 py-3 w-10" />
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        <span className="px-2 inline-flex text-caption-md leading-5 font-bold rounded-full bg-accent/10 text-accent border border-accent/30">
          {capitalizeText(product.variantLabel)}
        </span>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-text-primary text-center">
        {formatCurrency(product.price)}
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
        <StockBadge stock={product.stock} hideWhenInStock={false} countFormat="units" className="font-bold" />
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-body-sm text-center">
        <div className="flex items-center justify-center gap-1">
          <ImageIcon size={16} className="text-text-muted" />
          <span className="text-text-secondary">{variantImageCount(product)}</span>
        </div>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
    </tr>
  );
}

interface VariantChildRowsProps {
  productId: string;
  variants: FlattenedProduct[];
}

export function VariantChildRows({ productId, variants }: VariantChildRowsProps) {
  if (hasCombination(variants)) {
    const sizeGroups = groupBySize(variants);
    return (
      <>
        {Object.entries(sizeGroups).map(([size, sizeVariants]) =>
          sizeVariants.length === 1 ? (
            <CombinationSingleRow key={sizeVariants[0].id} product={sizeVariants[0]} />
          ) : (
            <Fragment key={`${productId}-${size}`}>
              <CombinationGroupRows size={size} sizeVariants={sizeVariants} />
            </Fragment>
          )
        )}
      </>
    );
  }

  return (
    <>
      {variants.map(product => (
        <SimpleVariantRow key={product.id} product={product} />
      ))}
    </>
  );
}
