/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

interface VariantSelectorProps {
  sizes: string[];
  colors: string[];
  selectedSize: string;
  selectedColor: string;
  onSelectSize: (size: string) => void;
  onSelectColor: (color: string) => void;
  currentStock: number;
  sizingType?: 'size' | 'age' | null;
}

function titleCase(value: string): string {
  return value.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VariantSelector({
  sizes,
  colors,
  selectedSize,
  selectedColor,
  onSelectSize,
  onSelectColor,
  currentStock,
  sizingType,
}: VariantSelectorProps) {
  const sizeLabel = sizingType === 'age' ? 'Age' : 'Size';

  return (
    <>
      {/* Size Selector */}
      {sizes && sizes.length > 0 && (
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-body-md md:text-body-lg text-text-primary">Select {sizeLabel}</h3>
            {currentStock <= 0 && (
              <span className="text-body-sm text-destructive font-medium">
                Out of Stock - Cannot select {sizingType === 'age' ? 'age' : 'size'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map(size => (
              <button
                key={size}
                onClick={() => currentStock > 0 && onSelectSize(size)}
                className={`px-4 py-3 md:px-4 md:py-2 border rounded-control transition-all text-body-sm md:text-body-md ${
                  selectedSize === size && currentStock > 0
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:border-border-strong text-text-primary'
                } ${currentStock <= 0 ? 'opacity-50 cursor-not-allowed bg-background-tertiary' : ''}`}
                aria-pressed={selectedSize === size}
                disabled={currentStock <= 0}
              >
                {titleCase(size)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color Selector */}
      {colors.length > 0 && (
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-body-md md:text-body-lg text-text-primary">Select Color</h3>
            {currentStock <= 0 && (
              <span className="text-body-sm text-destructive font-medium">
                Out of Stock - Cannot select color
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map(color => (
              <button
                key={color}
                onClick={() => currentStock > 0 && onSelectColor(color)}
                className={`px-4 py-3 md:px-4 md:py-2 border rounded-control flex items-center transition-all text-text-primary ${
                  selectedColor === color && currentStock > 0
                    ? 'border-primary bg-primary/10 text-text-primary'
                    : 'hover:border-border-strong'
                } ${currentStock <= 0 ? 'opacity-50 cursor-not-allowed bg-background-tertiary' : ''}`}
                aria-pressed={selectedColor === color}
                disabled={currentStock <= 0}
              >
                <span className="text-body-sm md:text-body-md">{titleCase(color)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
