/**
 * COMMERCE data — the measurement tables behind the size guide.
 *
 * Reference data, in code and not in the database, for the same reason the
 * Nigerian state/LGA list next door is: it is not per-shop and it is not
 * per-deployment. What *is* per-shop — "our sleepsuits run long in the arm" —
 * is categories.size_guidance and the per-product fit note, both editable in
 * the admin and both rendered above these tables.
 *
 * These are standard UK/EU-style baby and children's bands, which is what
 * imported stock is cut to. They are stated as ranges and labelled as a guide,
 * because a chart quoted to the centimetre invites a parent to trust it over
 * the tape measure — and the whole point of publishing one is to reduce the
 * "it didn't fit" conversation, not to move the argument onto whose chart is
 * right.
 *
 * `aliases` is the part that does the work at runtime: a product's sizes are
 * free text typed by an admin ("0-3 months", "0-3M", "3-6m"), and they have to
 * land on the right row so the guide can highlight the sizes this product
 * actually sells.
 */

export interface SizeChartRow {
  /** As shown in the first column. */
  label: string;
  /** Lower-cased forms a product size might be written as. */
  aliases: string[];
  /** One per chart column, in order. */
  values: string[];
}

export interface SizeChart {
  id: 'baby' | 'kids' | 'letter' | 'maternity';
  title: string;
  /** What the first column holds — "Age", "Size". */
  keyColumn: string;
  columns: string[];
  rows: SizeChartRow[];
  /** Shown under the table. The honest caveat, per chart. */
  note: string;
}

const BABY: SizeChart = {
  id: 'baby',
  title: 'Baby sizes (up to 2 years)',
  keyColumn: 'Age',
  columns: ['Height', 'Weight', 'Chest'],
  rows: [
    { label: 'Newborn', aliases: ['newborn', 'nb', '0m', '0 months'], values: ['up to 50 cm', 'up to 3.5 kg', '38 cm'] },
    { label: '0-3 months', aliases: ['0-3 months', '0-3m', '0-3', '3m'], values: ['50-58 cm', '3.5-5.5 kg', '41 cm'] },
    { label: '3-6 months', aliases: ['3-6 months', '3-6m', '3-6', '6m'], values: ['58-66 cm', '5.5-7.5 kg', '44 cm'] },
    { label: '6-9 months', aliases: ['6-9 months', '6-9m', '6-9', '9m'], values: ['66-72 cm', '7.5-9 kg', '46 cm'] },
    { label: '9-12 months', aliases: ['9-12 months', '9-12m', '9-12', '12m'], values: ['72-78 cm', '9-10 kg', '48 cm'] },
    { label: '12-18 months', aliases: ['12-18 months', '12-18m', '12-18', '18m'], values: ['78-84 cm', '10-11.5 kg', '50 cm'] },
    { label: '18-24 months', aliases: ['18-24 months', '18-24m', '18-24', '24m', '2t'], values: ['84-92 cm', '11.5-12.5 kg', '52 cm'] },
  ],
  note:
    'Go by height and weight rather than age — a big six-month-old is usually happier in the 6-9 band. If your baby is between two bands, choose the larger one: they grow into it within weeks.',
};

const KIDS: SizeChart = {
  id: 'kids',
  title: 'Kids & pre-teen sizes (2-12 years)',
  keyColumn: 'Age',
  columns: ['Height', 'Chest', 'Waist'],
  rows: [
    { label: '2-3 years', aliases: ['2-3 years', '2-3y', '2-3', '3y', '3'], values: ['92-98 cm', '53 cm', '51 cm'] },
    { label: '3-4 years', aliases: ['3-4 years', '3-4y', '3-4', '4y', '4'], values: ['98-104 cm', '55 cm', '52 cm'] },
    { label: '4-5 years', aliases: ['4-5 years', '4-5y', '4-5', '5y', '5'], values: ['104-110 cm', '57 cm', '53 cm'] },
    { label: '5-6 years', aliases: ['5-6 years', '5-6y', '5-6', '6y', '6'], values: ['110-116 cm', '59 cm', '54 cm'] },
    { label: '6-7 years', aliases: ['6-7 years', '6-7y', '6-7', '7y', '7'], values: ['116-122 cm', '61 cm', '55 cm'] },
    { label: '7-8 years', aliases: ['7-8 years', '7-8y', '7-8', '8y', '8'], values: ['122-128 cm', '64 cm', '57 cm'] },
    { label: '8-9 years', aliases: ['8-9 years', '8-9y', '8-9', '9y', '9'], values: ['128-134 cm', '67 cm', '58 cm'] },
    { label: '9-10 years', aliases: ['9-10 years', '9-10y', '9-10', '10y', '10'], values: ['134-140 cm', '70 cm', '60 cm'] },
    { label: '10-11 years', aliases: ['10-11 years', '10-11y', '10-11', '11y', '11'], values: ['140-146 cm', '73 cm', '62 cm'] },
    { label: '11-12 years', aliases: ['11-12 years', '11-12y', '11-12', '12y', '12'], values: ['146-152 cm', '76 cm', '64 cm'] },
  ],
  note:
    'Height is the reliable column at this age — children of the same age differ by a full band. Measure from the floor to the top of the head, without shoes.',
};

const LETTER: SizeChart = {
  id: 'letter',
  title: 'Letter sizes',
  keyColumn: 'Size',
  columns: ['Age', 'Height', 'Chest'],
  rows: [
    { label: 'XS', aliases: ['xs', 'extra small'], values: ['2-3 years', '92-98 cm', '53 cm'] },
    { label: 'S', aliases: ['s', 'small'], values: ['4-5 years', '104-110 cm', '57 cm'] },
    { label: 'M', aliases: ['m', 'medium'], values: ['6-7 years', '116-122 cm', '61 cm'] },
    { label: 'L', aliases: ['l', 'large'], values: ['8-9 years', '128-134 cm', '67 cm'] },
    { label: 'XL', aliases: ['xl', 'extra large'], values: ['10-11 years', '140-146 cm', '73 cm'] },
    { label: 'XXL', aliases: ['xxl', '2xl'], values: ['11-12 years', '146-152 cm', '76 cm'] },
  ],
  note:
    'Letter sizes vary more between brands than any other kind. Where a garment has both, the age band and the chest measurement are the ones to trust.',
};

const MATERNITY: SizeChart = {
  id: 'maternity',
  title: 'Maternity sizes',
  keyColumn: 'Size',
  columns: ['UK size', 'Bust', 'Waist (pre-pregnancy)', 'Hip'],
  rows: [
    { label: 'S', aliases: ['s', 'small'], values: ['8-10', '86-91 cm', '68-74 cm', '92-97 cm'] },
    { label: 'M', aliases: ['m', 'medium'], values: ['12-14', '94-99 cm', '76-81 cm', '99-104 cm'] },
    { label: 'L', aliases: ['l', 'large'], values: ['16-18', '102-107 cm', '84-89 cm', '107-112 cm'] },
    { label: 'XL', aliases: ['xl', 'extra large'], values: ['20-22', '112-117 cm', '94-99 cm', '117-122 cm'] },
  ],
  note:
    'Choose the size you wore before pregnancy — maternity pieces are cut with the growing room already in them, so sizing up usually gives a loose fit everywhere else.',
};

export const SIZE_CHARTS = { baby: BABY, kids: KIDS, letter: LETTER, maternity: MATERNITY } as const;

/** How to take each measurement, for the guide's footer. Shared by every chart. */
export const MEASURING_TIPS: Array<{ what: string; how: string }> = [
  {
    what: 'Height',
    how: 'Stand them against a wall without shoes, or lay a baby flat and measure heel to head.',
  },
  {
    what: 'Chest',
    how: 'Around the fullest part, under the arms, with the tape flat and not pulled tight.',
  },
  {
    what: 'Waist',
    how: 'Around the natural waist — for a toddler, wherever the trouser waistband sits.',
  },
];
