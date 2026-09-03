/**
 * CORE layer — a schema.org JSON-LD block. No branding, no business logic.
 *
 * A server component: structured data has to be in the HTML the crawler is
 * served, not written in by an effect afterwards.
 */

interface JsonLdProps {
  /** Already-built schema.org object — see lib/commerce/product-seo.ts. */
  data: Record<string, unknown> | Record<string, unknown>[];
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify does not escape "<", so a product whose name or
      // description contained "</script>" would close this tag and turn stored
      // text into markup. Escaping it keeps the JSON byte-identical to a parser
      // and inert to the HTML tokenizer.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
