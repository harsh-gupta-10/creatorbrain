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
  formatCount,
  formatDate,
} from '../components/ui';

const errMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

const CURRENCY_BY_MARKETPLACE: Record<string, string> = {
  'www.amazon.in': 'INR',
  'www.amazon.com': 'USD',
  'www.amazon.co.uk': 'GBP',
  'www.amazon.de': 'EUR',
  'www.amazon.fr': 'EUR',
  'www.amazon.it': 'EUR',
  'www.amazon.es': 'EUR',
  'www.amazon.ca': 'CAD',
  'www.amazon.com.au': 'AUD',
  'www.amazon.co.jp': 'JPY',
};

function moneyFormatter(marketplace: string) {
  const currency = CURRENCY_BY_MARKETPLACE[marketplace] || 'INR';
  const nf = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  return (n: number) => nf.format(Math.round(n || 0));
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
    <div className="flex gap-3">
      <div className="flex flex-col justify-between text-right meta !leading-none shrink-0" style={{ height: chartH }}>
        {ticks.map((t, i) => (
          <span key={i}>{money(t)}</span>
        ))}
      </div>
      <div className="flex-1 min-w-0">
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
    </div>
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
  const [csvError, setCsvError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadAmazonData();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.settings.getSettings();
      setAmazonOn(res.monetization?.amazon === true);
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
    try {
      const res = await api.amazon.search(searchQuery.trim());
      setSearchResults(res.results || []);
      if (res.isMock) setIsMockMode(true);
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
    if (!csvText.trim()) return;
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
  const topMax = topProducts[0]?.[1] || 1;

  const off = amazonOn === false;
  const taggedUrl = (url: string) => (partnerTag ? `${url}${url.includes('?') ? '&' : '?'}tag=${partnerTag}` : url);

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
          !off && (
            <>
              <button onClick={handleHealthCheck} disabled={isHealthChecking} className="btn btn-secondary">
                {isHealthChecking ? <Spinner /> : <RefreshCw {...ICON} className="text-fg-2" />}
                Check links
              </button>
              <button onClick={() => setShowCsvModal(true)} className="btn btn-secondary">
                <Upload {...ICON} className="text-fg-2" />
                Import earnings
              </button>
            </>
          )
        }
      />

      {off && (
        <div className="card mb-8">
          <EmptyState
            icon={<ShoppingBag {...ICON} />}
            title="Amazon Associates is off"
            description="Turn it on in Settings to tag product links, track earnings and add buy buttons to your bio page. You can still search the catalog below."
          />
        </div>
      )}

      {isMockMode && (
        <div className="flex items-center gap-2 text-[13px] text-fg-3 mb-6">
          <Info {...ICON} className="shrink-0" />
          Showing sample catalog data. Add Amazon API keys in Settings for live prices
        </div>
      )}

      {error && (
        <div className="mb-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {healthStatusMsg && (
        <div className="mb-6 rounded-[8px] bg-positive-soft text-positive text-[13px] px-3 py-2 flex items-center gap-2">
          <Check {...ICON} className="shrink-0" />
          {healthStatusMsg}
        </div>
      )}

      {!off && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
            <Stat label="Referred revenue" value={money(totalRevenue)} note={`${formatCount(totalItems)} items shipped`} />
            <Stat
              label="Commission"
              value={money(totalEarnings)}
              note={totalRevenue ? `${effectiveRate.toFixed(1)}% of referred revenue` : 'No earnings imported yet'}
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
                  title="No earnings yet"
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
                    <div className="text-[13px] text-fg-2 mb-3">Top products by commission</div>
                    <div className="space-y-3">
                      {topProducts.map(([title, value]) => (
                        <div key={title}>
                          <div className="flex items-baseline justify-between gap-3 text-[13px]">
                            <span className="truncate text-fg">{title}</span>
                            <span className="meta shrink-0">{money(value)}</span>
                          </div>
                          <div className="mt-1 h-1 rounded-full bg-raised">
                            <div className="h-1 rounded-full bg-fg-3" style={{ width: `${(value / topMax) * 100}%` }} />
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

      {/* Search */}
      <section className="mb-8">
        <SectionTitle title="Find a product" />
        <div className="card p-5 space-y-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Product name or ASIN"
                aria-label="Search Amazon products"
                className="input !pl-9"
              />
            </div>
            <button type="submit" disabled={isSearching} className="btn btn-primary">
              {isSearching && <Spinner />}
              Search
            </button>
          </form>

          {searchError && <ErrorNote>{searchError}</ErrorNote>}

          {searchResults.length > 0 && (
            <ul className="divide-y divide-line border-t border-line -mx-5 -mb-5">
              {searchResults.map((prod) => (
                <li key={prod.asin} className="flex items-center gap-3 px-5 py-3">
                  <img
                    src={prod.image_url}
                    alt=""
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
                  <button onClick={() => handleImportProduct(prod)} className="btn btn-secondary btn-sm shrink-0">
                    <Plus {...ICON} />
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Library */}
      {(!off || products.length > 0) && (
        <section>
          <SectionTitle title="Your products" meta={products.length || undefined} />
          {loading ? (
            <div className="card flex items-center justify-center gap-2 py-12 text-fg-3">
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
                        alt=""
                        className="w-16 h-16 rounded-[8px] object-contain bg-white border border-line shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-fg line-clamp-2">{prod.title}</div>
                        <div className="mt-1 font-mono num text-fg">{prod.price_str}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 meta min-w-0">
                      <span className={`dot ${available ? 'bg-positive' : 'bg-warning'}`} />
                      <span className="truncate">{prod.availability || 'Unknown'}</span>
                      <span>·</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="panel w-full max-w-lg p-6" role="dialog" aria-modal="true" aria-labelledby="csv-title">
            <div className="flex items-center justify-between mb-2">
              <h3 id="csv-title" className="text-[15px] font-medium text-fg">
                Import earnings
              </h3>
              <button onClick={() => setShowCsvModal(false)} className="btn btn-ghost btn-sm !px-2" aria-label="Close">
                <X {...ICON} />
              </button>
            </div>
            <p className="text-[13px] text-fg-2 mb-4">
              Paste rows from your Associates earnings report. Columns: date, ASIN, product title, items ordered, items
              shipped, revenue, commission.
            </p>

            <form onSubmit={handleCsvImport} className="space-y-4">
              {csvError && <ErrorNote>{csvError}</ErrorNote>}
              {importCount !== null && (
                <div className="rounded-[8px] bg-positive-soft text-positive text-[13px] px-3 py-2 flex items-center gap-2">
                  <Check {...ICON} className="shrink-0" />
                  Imported {importCount} rows
                </div>
              )}

              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                aria-label="Earnings CSV"
                placeholder={`Date,ASIN,Product Title,Items Ordered,Items Shipped,Revenue,Commission\n2026-11-12,B0D3G78JKL,Motorola Edge 50 Fusion,4,4,91996.0,2299.9`}
                className="input font-mono !text-[12px]"
              />

              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowCsvModal(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
