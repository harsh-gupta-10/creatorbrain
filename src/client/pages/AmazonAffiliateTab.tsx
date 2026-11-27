import { AmazonLinkBuilder, AmazonReportsPanel } from '../components/AmazonTools';
import { AMAZON_CURRENCIES, tagAmazonProduct } from '../../shared/amazon';
import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, Search, Plus, RefreshCw, ExternalLink, ShieldCheck, Upload, Check, X, Info } from 'lucide-react';
import { api } from '../lib/api';
import type { Product, EarningsReport } from '../../shared/types';
import {
  ICON,
  PageHeader,
  Stat,
  SectionTitle,
  EmptyState,
  ErrorNote,
  Spinner,
  Dialog,
  formatCount,
  formatDate,
} from '../components/ui';

const errMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

function moneyFormatter(marketplace: string) {
  const currency = AMAZON_CURRENCIES[marketplace.replace(/^www\./, '')] || 'USD';
  const nf = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });
  return (n: number) => nf.format(n || 0);
}

/** Commission per report date, oldest first, last `limit` dates */
function commissionByDate(earnings: EarningsReport[], limit = 30) {
  const map = new Map<string, number>();
  for (const e of earnings) {
    const key = (e.report_date || '').slice(0, 10);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + (e.commission || 0));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-limit)
    .map(([date, value]) => ({ date, value }));
}

const EarningsChart: React.FC<{ series: { date: string; value: number }[]; money: (n: number) => string }> = ({
  series,
  money,
}) => {
  const max = Math.max(1, ...series.map((s) => s.value));
  const chartH = 180;
  const ticks = [max, max / 2, 0];

  return (
    <figure className="flex gap-3">
      <figcaption className="sr-only">Commission by report date</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">Report date</th>
            <th scope="col">Commission</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.date}>
              <th scope="row">{formatDate(s.date)}</th>
              <td>{money(s.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        className="flex flex-col justify-between text-right meta !leading-none shrink-0"
        style={{ height: chartH }}
        aria-hidden="true"
      >
        {ticks.map((t, i) => (
          <span key={i}>{money(t)}</span>
        ))}
      </div>
      <div className="flex-1 min-w-0" aria-hidden="true">
        <div className="relative" style={{ height: chartH }}>
          {[0, 0.5, 1].map((p) => (
            <div key={p} className="absolute inset-x-0 border-t border-line" style={{ top: `${p * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-1">
            {series.map((s, i) => {
              const latest = i === series.length - 1;
              return (
                <div
                  key={s.date}
                  className="flex-1 h-full flex items-end max-w-12"
                  title={`${formatDate(s.date)}: ${money(s.value)}`}
                >
                  <div
                    className={`w-full rounded-t-[2px] ${latest ? 'bg-accent' : 'bg-line-strong'}`}
                    style={{ height: s.value ? `${Math.max(2, (s.value / max) * 100)}%` : 0 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between mt-2 meta">
          <span>{formatDate(series[0]?.date)}</span>
          <span>{formatDate(series[series.length - 1]?.date)}</span>
        </div>
      </div>
    </figure>
  );
};

export const AmazonAffiliateTab: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [earnings, setEarnings] = useState<EarningsReport[]>([]);
  const [isMockMode, setIsMockMode] = useState(false);
  const [partnerTag, setPartnerTag] = useState('');
  const [marketplace, setMarketplace] = useState('www.amazon.in');
  const [amazonOn, setAmazonOn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [mode, setMode] = useState<'products' | 'variations' | 'categories'>('products');
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof api.amazon.browseCategories>>['categories']>(
    []
  );
  const [searchNotice, setSearchNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Health check state
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthStatusMsg, setHealthStatusMsg] = useState<string | null>(null);

  // CSV earnings upload state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importCount, setImportCount] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadAmazonData();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.settings.getSettings();
      setAmazonOn(!!res.amazonConfig?.partnerTag || res.monetization?.amazon === true);
      const tag = res.amazonConfig?.partnerTag || res.monetization?.partnerTag;
      if (tag) setPartnerTag(tag);
      const mkt = res.amazonConfig?.marketplace || res.monetization?.marketplace;
      if (mkt) setMarketplace(mkt);
    } catch {
      setAmazonOn(false);
    }
  };

  const loadAmazonData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, earnRes] = await Promise.all([api.amazon.getProducts(), api.amazon.getEarnings()]);
      setProducts(prodRes.products || []);
      setEarnings(earnRes.earnings || []);
      setIsMockMode(prodRes.isMock);
      if (prodRes.partnerTag) setPartnerTag((prev) => prev || prodRes.partnerTag);
      if (prodRes.marketplace) setMarketplace(prodRes.marketplace);
    } catch (err: unknown) {
      setError(errMessage(err, 'Could not load your products'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchNotice('');
    setSearchResults([]);
    setCategories([]);
    try {
      if (mode === 'categories') {
        const res = await api.amazon.browseCategories(searchQuery.trim());
        setCategories(res.categories);
        if (!res.categories.length) setSearchNotice('No matching browse categories.');
      } else {
        const res = await api.amazon.search(searchQuery.trim(), mode);
        setSearchResults(res.results || []);
        setIsMockMode(res.isMock);
        if (res.liveError)
          setSearchError(`${res.liveError} You can still build a link from an exact ASIN or URL below.`);
        else if (!res.results.length) setSearchNotice('No products found. Try an exact ASIN or a different search.');
      }
    } catch (err) {
      setSearchError(errMessage(err, 'Search failed'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportProduct = async (product: Product) => {
    setSearchError(null);
    try {
      await api.amazon.importProduct(product);
      setSearchResults((prev) => prev.filter((p) => p.asin !== product.asin));
      await loadAmazonData();
    } catch (err) {
      setSearchError(errMessage(err, 'Could not add this product'));
    }
  };

  const handleHealthCheck = async () => {
    setIsHealthChecking(true);
    setError(null);
    try {
      const res = await api.amazon.healthCheck();
      setHealthStatusMsg(res.status);
      setTimeout(() => setHealthStatusMsg(null), 4000);
      await loadAmazonData();
    } catch (err) {
      setError(errMessage(err, 'Link check failed'));
    } finally {
      setIsHealthChecking(false);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim() || importing) return;
    setImporting(true);
    setCsvError(null);

    try {
      const res = await api.amazon.importEarningsCsv(csvText.trim());
      setImportCount(res.importedCount);
      setTimeout(() => {
        setImportCount(null);
        setShowCsvModal(false);
        setCsvText('');
      }, 2000);
      await loadAmazonData();
    } catch (err) {
      setCsvError(errMessage(err, 'Import failed'));
    } finally {
      setImporting(false);
    }
  };

  const money = useMemo(() => moneyFormatter(marketplace), [marketplace]);
  const totalEarnings = earnings.reduce((acc, e) => acc + (e.commission || 0), 0);
  const totalRevenue = earnings.reduce((acc, e) => acc + (e.revenue || 0), 0);
  const totalItems = earnings.reduce((acc, e) => acc + (e.items_shipped || 0), 0);
  const series = useMemo(() => commissionByDate(earnings), [earnings]);
  const effectiveRate = totalRevenue ? (totalEarnings / totalRevenue) * 100 : 0;

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of earnings) {
      const key = e.product_title || e.asin || 'Unknown product';
      map.set(key, (map.get(key) || 0) + (e.commission || 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [earnings]);
  const topMax = Math.max(1, topProducts[0]?.[1] || 0);

  const off = amazonOn === false;
  const taggedUrl = (url: string) => tagAmazonProduct(url, marketplace, partnerTag) || url;

  return (
    <div>
      <PageHeader
        title="Amazon affiliate"
        description={
          <>
            Products you mention, tagged with your Associates ID
            {partnerTag && (
              <>
                {' '}
                <span className="font-mono text-fg">{partnerTag}</span>
              </>
            )}{' '}
            on <span className="font-mono text-fg">{marketplace}</span>
          </>
        }
        actions={
          <>
            {!off && (
              <button
                onClick={handleHealthCheck}
                disabled={isHealthChecking}
                aria-busy={isHealthChecking}
                className="btn btn-secondary"
              >
                {isHealthChecking ? <Spinner /> : <RefreshCw {...ICON} className="text-fg-2" />}
                Refresh prices
              </button>
            )}
            <button onClick={() => setShowCsvModal(true)} className="btn btn-secondary">
              <Upload {...ICON} className="text-fg-2" />
              Import earnings
            </button>
          </>
        }
      />

      {off && (
        <div className="card mb-8">
          <EmptyState
            icon={<ShoppingBag {...ICON} />}
            title="No tracking ID saved"
            description="Save your tracking ID in Settings to build tagged product links."
          />
        </div>
      )}

      {isMockMode && (
        <div className="flex items-center gap-2 text-[13px] text-fg-3 mb-6">
          <Info {...ICON} className="shrink-0" />
          Live catalog access requires Creators API credentials. Sample results are labeled.
        </div>
      )}

      {error && (
        <div className="mb-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div role="status">
        {healthStatusMsg && (
          <div className="mb-6 rounded-[8px] bg-positive-soft text-positive text-[13px] px-3 py-2 flex items-center gap-2">
            <Check {...ICON} className="shrink-0" />
            {healthStatusMsg}
          </div>
        )}
      </div>

      {(!off || earnings.length > 0) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
            <Stat
              label="Referred revenue"
              value={earnings.length ? money(totalRevenue) : '—'}
              note={earnings.length ? `${formatCount(totalItems)} items shipped` : 'No reports imported yet'}
            />
            <Stat
              label="Commission"
              value={earnings.length ? money(totalEarnings) : '—'}
              note={
                totalRevenue > 0
                  ? `${effectiveRate.toFixed(1)}% of referred revenue`
                  : earnings.length
                    ? 'From imported reports'
                    : 'No reports imported yet'
              }
            />
            <Stat label="Tracked products" value={formatCount(products.length)} />
          </div>
          <div className="flex items-center gap-2 text-[13px] text-fg-3 mb-8">
            <ShieldCheck {...ICON} className="shrink-0" />
            Every product card on your bio page carries the Associates disclosure and the date its price was checked
          </div>

          <section className="mb-8">
            <SectionTitle
              title="Commission by report date"
              meta={series.length ? `${series.length} days` : undefined}
            />
            <div className="card p-5">
              {series.length === 0 ? (
                <EmptyState
                  icon={<Upload {...ICON} />}
                  title="No earnings reports imported"
                  description="Import your Associates earnings report to see commission over time."
                  action={
                    <button onClick={() => setShowCsvModal(true)} className="btn btn-secondary btn-sm">
                      Import earnings
                    </button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <EarningsChart series={series} money={money} />
                  </div>
                  <div>
                    <h3 id="top-products-heading" className="text-[13px] text-fg-2 mb-3">
                      Top products by commission
                    </h3>
                    <div className="space-y-3" role="list" aria-labelledby="top-products-heading">
                      {topProducts.map(([title, value]) => (
                        <div key={title} role="listitem">
                          <div className="flex items-baseline justify-between gap-3 text-[13px]">
                            <span className="truncate text-fg">{title}</span>
                            <span className="meta shrink-0">{money(value)}</span>
                          </div>
                          <div className="mt-1 h-1 rounded-full bg-raised" aria-hidden="true">
                            <div
                              className="h-1 rounded-full bg-fg-3"
                              style={{ width: `${Math.max(0, (value / topMax) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className="card p-5 mb-8 space-y-3">
        <h2 className="font-medium">Amazon report files</h2>
        <p className="text-fg-2">
          Check for files Amazon exposes to this connection. To update your totals, import a dated earnings export.
        </p>
        <AmazonReportsPanel />
      </section>

      {/* Search */}
      <section className="mb-8">
        <SectionTitle title="Find a product" />
        <div className="card p-5 space-y-4">
          <label className="block text-[13px]">
            Catalog tool
            <select
              className="input mt-1"
              value={mode}
              disabled={isSearching}
              onChange={(e) => {
                setMode(e.target.value as typeof mode);
                setSearchQuery('');
                setCategories([]);
                setSearchResults([]);
                setSearchError(null);
                setSearchNotice('');
              }}
            >
              <option value="products">Search or look up product</option>
              <option value="variations">Find product variations</option>
              <option value="categories">Look up browse categories</option>
            </select>
          </label>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  mode === 'categories'
                    ? 'Browse node IDs (comma separated)'
                    : mode === 'variations'
                      ? 'Parent ASIN'
                      : 'Product name, ASIN, or full Amazon URL'
                }
                aria-label="Search Amazon products"
                className="input !pl-9"
              />
            </div>
            <button type="submit" disabled={isSearching} aria-busy={isSearching} className="btn btn-primary">
              {isSearching && <Spinner />}
              Search
            </button>
          </form>

          {searchNotice && <p role="status">{searchNotice}</p>}
          {categories.length > 0 && (
            <ul className="space-y-2">
              {categories.map((category) => (
                <li key={category.id} className="well p-3">
                  {category.displayName} <span className="meta">{category.id}</span>
                  {category.children?.length ? (
                    <ul>
                      {category.children.map((child) => (
                        <li key={child.id}>
                          {child.displayName} <span className="meta">{child.id}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {searchError && <ErrorNote>{searchError}</ErrorNote>}
          <p className="sr-only" role="status">
            {!isSearching && searchResults.length > 0 ? `${searchResults.length} products found` : ''}
          </p>

          {searchResults.length > 0 && (
            <ul className="divide-y divide-line border-t border-line -mx-5 -mb-5">
              {searchResults.map((prod) => (
                <li key={prod.asin} className="flex items-center gap-3 px-5 py-3">
                  <img
                    src={prod.image_url}
                    alt={prod.title || 'Product'}
                    width={48}
                    height={48}
                    loading="lazy"
                    className="w-12 h-12 rounded-[8px] object-contain bg-white border border-line shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-fg truncate">{prod.title}</div>
                    <div className="mt-1 flex items-baseline gap-2 min-w-0">
                      <span className="font-mono num text-[13px] text-fg">{prod.price_str}</span>
                      <span className="meta truncate">
                        {prod.asin} · {prod.price_timestamp}
                      </span>
                    </div>
                  </div>
                  {!prod.is_mock && (
                    <button onClick={() => handleImportProduct(prod)} className="btn btn-secondary btn-sm shrink-0">
                      <Plus {...ICON} />
                      Add<span className="sr-only"> {prod.title}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <AmazonLinkBuilder marketplace={marketplace} />

      {/* Library */}
      {(!off || products.length > 0) && (
        <section>
          <SectionTitle title="Your products" meta={products.length || undefined} />
          {loading ? (
            <div className="card flex items-center justify-center gap-2 py-12 text-fg-3" role="status">
              <Spinner />
              Loading products
            </div>
          ) : products.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<ShoppingBag {...ICON} />}
                title="No products yet"
                description="Search above and add the products you review or recommend."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map((prod) => {
                const available = /in stock|available/i.test(prod.availability || '');
                return (
                  <div key={prod.id} className="card p-4 flex flex-col">
                    <div className="flex items-start gap-3">
                      <img
                        src={prod.image_url}
                        alt={prod.title || 'Product'}
                        width={64}
                        height={64}
                        loading="lazy"
                        className="w-16 h-16 rounded-[8px] object-contain bg-white border border-line shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-fg line-clamp-2">{prod.title}</div>
                        <div className="mt-1 font-mono num text-fg">{prod.price_str}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 meta min-w-0">
                      <span className={`dot ${available ? 'bg-positive' : 'bg-warning'}`} aria-hidden="true" />
                      <span className="truncate">{prod.availability || 'Unknown'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{prod.asin}</span>
                    </div>
                    <div className="meta mt-1 truncate">Price as of {prod.price_timestamp}</div>
                    <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                      <span className="meta truncate">{partnerTag ? `tag=${partnerTag}` : 'No partner tag set'}</span>
                      <a
                        href={taggedUrl(prod.product_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] text-accent-ink hover:underline shrink-0"
                      >
                        Open on Amazon
                        <span className="sr-only">: {prod.title} (opens in a new tab)</span>
                        <ExternalLink {...ICON} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* CSV earnings import */}
      {showCsvModal && (
        <Dialog
          onClose={() => setShowCsvModal(false)}
          labelledBy="csv-title"
          className="panel w-full max-w-lg p-6"
          backdropClassName="bg-black/30"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 id="csv-title" className="text-[15px] font-medium text-fg">
              Import earnings
            </h2>
            <button onClick={() => setShowCsvModal(false)} className="btn btn-ghost btn-sm !px-2" aria-label="Close">
              <X {...ICON} />
            </button>
          </div>
          <p id="csv-help" className="text-[13px] text-fg-2 mb-4">
            In Associates Central, download the Earnings report grouped by date for the whole store. Upload a CSV or
            TSV, or paste its contents. Importing replaces existing rows for the dates in the file.
          </p>

          <form onSubmit={handleCsvImport} className="space-y-4">
            {marketplace === 'amazon.in' && (
              <a
                className="underline"
                href="https://affiliate-program.amazon.in/p/reporting/earnings"
                target="_blank"
                rel="noreferrer"
              >
                Open Amazon India Earnings Report
              </a>
            )}
            <label className="block text-[13px]">
              Upload earnings report
              <input
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                className="input mt-1 py-2 h-auto"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1_500_000) {
                    setCsvText('');
                    setCsvError('Choose a smaller file or shorter date range.');
                    return;
                  }
                  try {
                    const bytes = await file.arrayBuffer();
                    const prefix = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
                    const encoding =
                      prefix[0] === 255 && prefix[1] === 254
                        ? 'utf-16le'
                        : prefix[0] === 254 && prefix[1] === 255
                          ? 'utf-16be'
                          : 'utf-8';
                    setCsvText(new TextDecoder(encoding).decode(bytes));
                    setCsvError(null);
                  } catch {
                    setCsvText('');
                    setCsvError('Could not read this file.');
                  }
                }}
              />
            </label>
            {csvError && <ErrorNote>{csvError}</ErrorNote>}
            {importCount !== null && (
              <div
                role="status"
                className="rounded-[8px] bg-positive-soft text-positive text-[13px] px-3 py-2 flex items-center gap-2"
              >
                <Check {...ICON} className="shrink-0" />
                Imported {importCount} rows
              </div>
            )}

            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              aria-label="Earnings CSV"
              aria-describedby="csv-help"
              placeholder={`Date,ASIN,Product Title,Items Ordered,Items Shipped,Revenue,Commission\n2026-11-12,B0D3G78JKL,Motorola Edge 50 Fusion,4,4,91996.0,2299.9`}
              className="input font-mono !text-[12px]"
            />

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowCsvModal(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={importing || !csvText.trim()}>
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};
