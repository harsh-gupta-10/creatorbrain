import { describe, expect, it } from 'vitest';
import { parseEarningsReport } from '../src/worker/amazon/earnings';
import { tagAmazonProduct } from '../src/shared/amazon';

describe('Associates earnings imports', () => {
  it('reads a BOM, a report title, quoted commas and returns from a dated CSV', () => {
    const report =
      '\uFEFFAmazon Earnings Report\r\nDate,ASIN,Product Title,Items Shipped,Shipped Items Revenue,Advertising Fees\r\n' +
      '26/11/2026,B012345678,"Basket, round",1,"₹1,000.00",220.75\r\n' +
      '2026-11-27,B012345678,"Basket, round",-1,(200.00),(20.75)\r\n' +
      'Total,,,,800,200';
    const rows = parseEarningsReport(report, 'amazon.in');
    expect(rows).toMatchObject([
      {
        report_date: '2026-11-26',
        product_title: 'Basket, round',
        items_shipped: 1,
        revenue: 1000,
        commission: 220.75,
      },
      { report_date: '2026-11-27', items_shipped: -1, revenue: -200, commission: -20.75 },
    ]);
  });
  it('accepts dated TSV totals without pretending to know the products', () => {
    const rows = parseEarningsReport(
      'Date\tDispatched Items\tTotal Earnings\tCurrency\n2026-11-26\t0\t200.00\tINR',
      'amazon.in'
    );
    expect(rows).toMatchObject([{ items_shipped: 0, items_ordered: 0, asin: undefined, commission: 200 }]);
  });
  it.each([
    'Date,Items Ordered\n2026-11-26,2',
    'Date,Commission\n2026-02-30,1.00',
    'Date,Commission\n2026-11-26,unknown',
    'Date,Commission,Currency\n2026-11-26,10,EUR',
  ])('rejects unsupported or invalid report data', (file) => {
    expect(() => parseEarningsReport(file, 'amazon.in')).toThrow();
  });
});

it('tags an exact product, replaces an old tag, and rejects a different marketplace', () => {
  expect(tagAmazonProduct('https://www.amazon.in/dp/B012345678?tag=old-21&th=1', 'amazon.in', 'test-21')).toBe(
    'https://www.amazon.in/dp/B012345678?tag=test-21&th=1'
  );
  expect(tagAmazonProduct('https://www.amazon.com/dp/B012345678', 'amazon.in', 'test-21')).toBeNull();
  expect(tagAmazonProduct('https://www.amazon.in.evil.example/dp/B012345678', 'amazon.in', 'test-21')).toBeNull();
});
