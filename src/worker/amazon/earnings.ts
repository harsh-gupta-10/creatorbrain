import type { EarningsReport } from '../../shared/types';
import { AMAZON_CURRENCIES, ASIN_RE } from '../../shared/amazon';

export const MAX_REPORT_CHARS = 500_000;
type Row = Omit<EarningsReport, 'id' | 'creator_id' | 'created_at'>;

function table(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (quoted || value === '') quoted = !quoted;
      else value += char;
    } else if (!quoted && (char === separator || char === '\n' || char === '\r')) {
      row.push(value.trim());
      value = '';
      if (char !== separator) {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else value += char;
  }
  if (quoted) throw new Error('The earnings report has an incomplete quoted field.');
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(inr|usd|eur|gbp|cad)$/, '');
const columns = {
  date: [
    'date',
    'reportdate',
    'shipmentdate',
    'shippeddate',
    'dateordered',
    'shippingdate',
    'dateshipped',
    'datedispatched',
    'period',
    'day',
  ],
  commission: [
    'commission',
    'commissions',
    'commissionincome',
    'totalcommission',
    'advertisingfees',
    'totaladvertisingfees',
    'referralfees',
    'totalreferralfees',
    'referralcommission',
    'feeearnings',
    'earnings',
    'totalearnings',
    'fees',
  ],
  revenue: [
    'revenue',
    'shippedrevenue',
    'shippeditemrevenue',
    'shippeditemsrevenue',
    'dispatcheditemsrevenue',
    'totalrevenue',
    'dispatchedrevenue',
  ],
  asin: ['asin', 'productasin', 'shippedasin'],
  title: ['producttitle', 'title', 'productname', 'itemname'],
  ordered: ['itemsordered', 'ordereditems', 'orderedquantity'],
  shipped: ['itemsshipped', 'shippeditems', 'dispatcheditems', 'itemsdispatched', 'quantity', 'shippedquantity'],
  currency: ['currency', 'currencycode'],
};

function parseDate(value: string, marketplace: string): string {
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value);
  const short = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value);
  const monthFirst = marketplace === 'amazon.com' || marketplace === 'amazon.ca';
  const parts = iso ? iso.slice(1) : short ? [short[3], short[monthFirst ? 1 : 2], short[monthFirst ? 2 : 1]] : null;
  if (!parts) return '';
  const result = parts.map((p) => p.padStart(2, '0')).join('-');
  const date = new Date(result);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === result ? result : '';
}

function parseNumber(value: string, integer: boolean, marketplace: string): number {
  if (!value || /^[-–—]$/.test(value)) return 0;
  const amount = value.replace(/^\((.*)\)$/, '-$1').replace(/INR|USD|GBP|EUR|CAD|Rs\.?|[₹$£€\s]/gi, '');
  const german = marketplace === 'amazon.de' && amount.includes(',');
  const normalized = german ? amount.replace(/[.,]/g, (char) => (char === '.' ? ',' : '.')) : amount;
  const formatted = /^-?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/;
  const number = Number(normalized.replace(/,/g, ''));
  if (!formatted.test(normalized) || !Number.isFinite(number) || (integer && !Number.isSafeInteger(number))) {
    throw new Error('A number in the earnings report is invalid.');
  }
  return number;
}

export function parseEarningsReport(text: string, marketplace: string): Row[] {
  const raw = text.replace(/^\uFEFF/, '');
  for (const separator of ['\t', ',', ';']) {
    let rows;
    try {
      rows = table(raw, separator);
    } catch {
      continue;
    }
    const header = rows.findIndex((row) => {
      const names = row.map(normalize);
      return columns.date.some((a) => names.includes(a)) && columns.commission.some((a) => names.includes(a));
    });
    if (header < 0) continue;
    const names = rows[header].map(normalize);
    const index = (key: keyof typeof columns) => names.findIndex((s) => columns[key].includes(s));
    const mapped: Row[] = [];
    for (const fields of rows.slice(header + 1)) {
      const get = (key: keyof typeof columns) => fields[index(key)] || '';
      if (fields.some((field) => /^(grand total|total|subtotal)$/i.test(field))) continue;
      const report_date = parseDate(get('date'), marketplace);
      if (fields.length !== names.length || !report_date || !get('commission'))
        throw new Error(
          'A report row is missing a valid date or commission. Export the full Earnings report grouped by date.'
        );
      const currency = get('currency').toUpperCase();
      if (currency && currency !== AMAZON_CURRENCIES[marketplace])
        throw new Error('The report currency does not match your marketplace.');
      const asin = get('asin').toUpperCase();
      if (asin && !ASIN_RE.test(asin)) throw new Error('The earnings report contains an invalid ASIN.');
      mapped.push({
        report_date,
        asin: asin || undefined,
        product_title: get('title').slice(0, 400) || undefined,
        items_ordered: parseNumber(get('ordered'), true, marketplace),
        items_shipped: parseNumber(get('shipped'), true, marketplace),
        revenue: parseNumber(get('revenue'), false, marketplace),
        commission: parseNumber(get('commission'), false, marketplace),
      });
    }
    if (!mapped.length) throw new Error('This report contains no earnings rows.');
    if (mapped.length > 500) throw new Error('Choose a shorter date range. Each import supports up to 500 rows.');
    return mapped;
  }
  throw new Error(
    'The report needs Date and Advertising Fees, Commission, or Earnings columns. Download the Earnings report grouped by date as CSV or TSV.'
  );
}
