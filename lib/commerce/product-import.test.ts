/**
 * The dry run the admin sees before committing an import is exactly these
 * functions, so what they report has to be what would actually happen.
 */
import { describe, it, expect } from 'vitest';
import { autoMapColumns, parseProductRows, toProductPayload, IMPORT_FIELDS } from './product-import';
import { readCsvTable } from './csv-parse';

const parse = (csv: string) => {
  const table = readCsvTable(csv);
  return parseProductRows(table.rows, autoMapColumns(table.headers));
};

describe('autoMapColumns', () => {
  it('matches headers by their field name', () => {
    const mapping = autoMapColumns(['name', 'price', 'stock']);
    expect(mapping).toMatchObject({ name: 0, price: 1, stock: 2 });
  });

  it('matches the spellings people actually use', () => {
    const mapping = autoMapColumns(['Product Name', 'Colour', 'QTY', 'Unit Price', 'Sub Category']);
    expect(mapping).toMatchObject({ name: 0, color: 1, stock: 2, price: 3, sub_category: 4 });
  });

  it('leaves a field unmapped rather than guessing wildly', () => {
    expect(autoMapColumns(['name', 'price']).sku).toBeNull();
  });

  it('has an entry for every importable field', () => {
    const mapping = autoMapColumns([]);
    expect(Object.keys(mapping).sort()).toEqual(IMPORT_FIELDS.map((f) => f.key).sort());
  });
});

describe('parseProductRows', () => {
  it('groups rows sharing a name into one product with several variants', () => {
    const { products, issues } = parse(
      'name,size,color,price,stock\n' +
      'Cotton Romper,0-3m,Red,1500,4\n' +
      'Cotton Romper,0-3m,Blue,1500,2\n' +
      'Cotton Romper,3-6m,Red,1800,1\n'
    );

    expect(issues).toEqual([]);
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Cotton Romper');
    expect(products[0].variants).toHaveLength(3);
  });

  it('reports the line number the person can see in their file', () => {
    // Line 3, not "row 1" — a blank line above must not shift the count.
    const { issues } = parse('name,price\nRomper,1500\n\n,900\n');
    expect(issues).toEqual([{ line: 4, field: 'name', message: 'Product name is required.' }]);
  });

  it('accepts money as a spreadsheet writes it', () => {
    const { products, issues } = parse('name,price,stock\nRomper,"₦1,500.00",3\n');
    expect(issues).toEqual([]);
    expect(products[0].variants[0].price).toBe(1500);
  });

  it('rejects a price that is not a number, naming the value', () => {
    const { issues } = parse('name,price\nRomper,ask us\n');
    expect(issues[0]).toMatchObject({ line: 2, field: 'price' });
    expect(issues[0].message).toContain('ask us');
  });

  it('rejects negative price and stock', () => {
    expect(parse('name,price\nRomper,-5\n').issues[0].message).toContain('negative');
    expect(parse('name,price,stock\nRomper,100,-1\n').issues[0].message).toContain('negative');
  });

  it('defaults missing stock to zero rather than failing the row', () => {
    const { products, issues } = parse('name,price,stock\nRomper,1500,\n');
    expect(issues).toEqual([]);
    expect(products[0].variants[0].stock).toBe(0);
  });

  it('treats a blank cost as not recorded, which is not zero', () => {
    const { products } = parse('name,price,cost\nRomper,1500,\n');
    expect(products[0].variants[0].cost).toBeNull();
  });

  it('refuses a product whose rows disagree about having a size', () => {
    // There is no single pricing mode for this, so guessing would silently
    // drop half the variants.
    const { issues } = parse('name,size,price\nRomper,0-3m,1500\nRomper,,1500\n');
    expect(issues.some((i) => i.message.includes('some rows have a size'))).toBe(true);
  });

  it('refuses a repeated size and colour combination', () => {
    const { issues } = parse(
      'name,size,color,price\nRomper,0-3m,Red,1500\nRomper,0-3m,Red,1800\n'
    );
    expect(issues.some((i) => i.message.includes('repeats the same size and colour'))).toBe(true);
  });

  it('refuses several rows with nothing to tell them apart', () => {
    const { issues } = parse('name,price\nRomper,1500\nRomper,1800\n');
    expect(issues.some((i) => i.message.includes('no size or colour'))).toBe(true);
  });

  it('groups on product id when given, so a rename still updates in place', () => {
    const { products } = parse(
      'product_id,name,size,price\n' +
      'abc-123,Old Name,0-3m,1500\n' +
      'abc-123,New Name,3-6m,1600\n'
    );
    expect(products).toHaveLength(1);
    expect(products[0].productId).toBe('abc-123');
  });

  it('lets later rows supply a description the first row left blank', () => {
    const { products } = parse(
      'name,size,price,description\n' +
      'Romper,0-3m,1500,\n' +
      'Romper,3-6m,1600,Soft cotton\n'
    );
    expect(products[0].description).toBe('Soft cotton');
  });

  it('keeps going after a bad row instead of abandoning the file', () => {
    const { products, issues } = parse('name,price\nGood,1500\nBad,nope\nAlsoGood,1200\n');
    expect(products.map((p) => p.name)).toEqual(['Good', 'AlsoGood']);
    expect(issues).toHaveLength(1);
  });
});

describe('toProductPayload', () => {
  it('builds a combination product from size and colour rows', () => {
    const { products } = parse(
      'name,size,color,price,stock\n' +
      'Romper,0-3m,Red,1500,4\n' +
      'Romper,3-6m,Blue,1800,2\n'
    );

    const payload = toProductPayload(products[0]);

    expect(payload.pricing_config.mode).toBe('combination');
    expect(payload.pricing_config.combinationPrices).toEqual({ '0-3m|Red': 1500, '3-6m|Blue': 1800 });
    expect(payload.pricing_config.combinationStock).toEqual({ '0-3m|Red': 4, '3-6m|Blue': 2 });
    // The card shows the cheapest variant, and stock is the sum.
    expect(payload.price).toBe(1500);
    expect(payload.stock).toBe(6);
    expect(payload.sizes).toEqual(['0-3m', '3-6m']);
    expect(payload.colors).toEqual(['Red', 'Blue']);
  });

  it('builds a size-only product', () => {
    const { products } = parse('name,size,price,stock\nRomper,0-3m,1500,4\nRomper,3-6m,1800,2\n');
    const payload = toProductPayload(products[0]);

    expect(payload.pricing_config.mode).toBe('size');
    expect(payload.pricing_config.sizePrices).toEqual({ '0-3m': 1500, '3-6m': 1800 });
    expect(payload.stock).toBe(6);
  });

  it('builds a colour-only product', () => {
    const { products } = parse('name,color,price,stock\nHat,Red,900,3\nHat,Blue,900,1\n');
    const payload = toProductPayload(products[0]);

    expect(payload.pricing_config.mode).toBe('color');
    expect(payload.pricing_config.colorPrices).toEqual({ Red: 900, Blue: 900 });
    expect(payload.stock).toBe(4);
  });

  it('builds a plain product with no variants', () => {
    const { products } = parse('name,price,stock\nBlanket,2500,7\n');
    const payload = toProductPayload(products[0]);

    expect(payload.pricing_config.mode).toBe('single');
    expect(payload.price).toBe(2500);
    expect(payload.stock).toBe(7);
  });

  it('keys costs the way the variant rows are keyed', () => {
    const { products } = parse(
      'name,size,color,price,cost\nRomper,0-3m,Red,1500,700\nRomper,3-6m,Blue,1800,\n'
    );
    // Only the recorded one. A blank cost stays unknown rather than becoming 0,
    // which would report the whole sale price as profit.
    expect(toProductPayload(products[0]).variant_costs).toEqual({ '0-3m|Red': 700 });
  });

  it('defaults the category so a minimal file still imports', () => {
    const { products } = parse('name,price\nBlanket,2500\n');
    expect(toProductPayload(products[0]).category).toBe('babies');
  });
});
