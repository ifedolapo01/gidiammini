/**
 * COMMERCE layer — a size chart, rendered.
 *
 * A real <table>, because that is what this is: a header row a screen reader
 * announces per cell, and a row header naming the band. A grid of divs would
 * read as thirty unrelated numbers.
 *
 * The whole table is shown and the product's own bands are marked, rather than
 * the table being filtered down to them. A parent choosing between 6-9 and
 * 9-12 months needs to see both, and the neighbouring rows are what tell them
 * whether sizing up means one centimetre or eight.
 *
 * Marked twice over: a tinted row plus a visible "In stock here" cue in the
 * first column, because colour alone carries nothing to a screen reader and
 * not much to a colourblind reader either.
 */
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SizeChart } from '@/lib/data/size-charts';

interface SizeChartTableProps {
  chart: SizeChart;
  /** Row labels this product actually sells — see matchedChartRows. */
  highlight?: Set<string>;
}

const TH = 'px-3 py-2 text-left text-caption-md font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap';
const TD = 'px-3 py-2 text-body-sm text-text-secondary whitespace-nowrap';

export default function SizeChartTable({ chart, highlight }: SizeChartTableProps) {
  const marked = highlight ?? new Set<string>();

  return (
    // Scrolls inside itself: four measurement columns do not fit a phone, and
    // the page must not scroll sideways.
    <div className="overflow-x-auto rounded-control border border-border">
      <table className="min-w-full divide-y divide-divider">
        <caption className="sr-only">
          {`${chart.title}. Rows marked "in stock here" are the sizes this product is sold in.`}
        </caption>
        <thead className="bg-background-secondary">
          <tr>
            <th scope="col" className={TH}>
              {chart.keyColumn}
            </th>
            {chart.columns.map((column) => (
              <th key={column} scope="col" className={TH}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {chart.rows.map((row) => {
            const sold = marked.has(row.label);

            return (
              <tr key={row.label} className={cn(sold && 'bg-primary/5')}>
                <th
                  scope="row"
                  className={cn(
                    'px-3 py-2 text-left text-body-sm whitespace-nowrap',
                    sold ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary'
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {row.label}
                    {sold && (
                      <>
                        <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        <span className="sr-only">in stock here</span>
                      </>
                    )}
                  </span>
                </th>
                {row.values.map((value, index) => (
                  <td key={chart.columns[index]} className={TD}>
                    {value}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
