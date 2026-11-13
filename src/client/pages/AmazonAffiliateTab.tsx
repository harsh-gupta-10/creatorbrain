import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Upload,
  Check,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Product, EarningsReport } from '../../shared/types';

export const AmazonAffiliateTab: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [earnings, setEarnings] = useState<EarningsReport[]>([]);
  const [isMockMode, setIsMockMode] = useState(true);
  const [partnerTag, setPartnerTag] = useState('techkabir-21');
  const [marketplace, setMarketplace] = useState('www.amazon.in');
  const [_loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Health check state
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthStatusMsg, setHealthStatusMsg] = useState<string | null>(null);

  // CSV Earnings Upload State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importCount, setImportCount] = useState<number | null>(null);

  useEffect(() => {
    loadAmazonData();
  }, []);

  const loadAmazonData = async () => {
    setLoading(true);
    try {
      const [prodRes, earnRes] = await Promise.all([
        api.amazon.getProducts(),
        api.amazon.getEarnings(),
      ]);
      setProducts(prodRes.products || []);
      setEarnings(earnRes.earnings || []);
      setIsMockMode(prodRes.isMock);
      setPartnerTag(prodRes.partnerTag);
      setMarketplace(prodRes.marketplace);
    } catch (err: unknown) {
      console.error('Failed to load Amazon data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await api.amazon.search(searchQuery.trim());
      setSearchResults(res.results || []);
    } catch (err) {
      console.error('Failed to search Amazon products:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportProduct = async (product: Product) => {
    try {
      await api.amazon.importProduct(product);
      setSearchResults((prev) => prev.filter((p) => p.asin !== product.asin));
      await loadAmazonData();
    } catch (err) {
      console.error('Failed to import product:', err);
    }
  };

  const handleHealthCheck = async () => {
    setIsHealthChecking(true);
    try {
      const res = await api.amazon.healthCheck();
      setHealthStatusMsg(res.status);
      setTimeout(() => setHealthStatusMsg(null), 4000);
      await loadAmazonData();
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setIsHealthChecking(false);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;

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
      console.error('CSV import failed:', err);
    }
  };

  const totalEarnings = earnings.reduce((acc, e) => acc + (e.commission || 0), 0);
  const totalRevenue = earnings.reduce((acc, e) => acc + (e.revenue || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              Amazon Affiliate & Creators API Manager
            </h2>
            {isMockMode ? (
              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Mock Data Mode
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Creators API
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Marketplace: <span className="font-mono text-indigo-600 font-medium">{marketplace}</span> · Associate Tag:{' '}
            <span className="font-mono text-slate-800 font-semibold">{partnerTag}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleHealthCheck}
            disabled={isHealthChecking}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isHealthChecking ? 'animate-spin' : ''}`} />
            Check Link Health
          </button>
          <button
            onClick={() => setShowCsvModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            Import CSV Earnings
          </button>
        </div>
      </div>

      {healthStatusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          {healthStatusMsg}
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Tracked Products</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{products.length}</div>
        </div>
        <div className="p-4.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Total Referred Revenue</span>
          <div className="text-2xl font-bold font-mono text-indigo-600 mt-1">
            ₹{totalRevenue.toLocaleString()}
          </div>
        </div>
        <div className="p-4.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Estimated Commission</span>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
            ₹{totalEarnings.toLocaleString()}
          </div>
        </div>
        <div className="p-4.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Compliance Disclosure</span>
          <div className="text-xs font-bold text-emerald-700 mt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> 100% ASCI & FTC Conformed
          </div>
        </div>
      </div>

      {/* Product Search & Import Bar */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
          <Search className="w-4 h-4 text-indigo-600" />
          Search & Import from Amazon Creators API (SearchItems)
        </h3>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords, phone models, audio gear (e.g. Motorola Edge, Sony XM5, Vivo T3 Pro)..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50"
          >
            {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Search
          </button>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="pt-2 space-y-3">
            <span className="text-xs font-semibold text-slate-600">Search Results:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.map((prod) => (
                <div
                  key={prod.asin}
                  className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3"
                >
                  <img
                    src={prod.image_url}
                    alt={prod.title}
                    className="w-14 h-14 rounded-lg object-cover bg-white border border-slate-200 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{prod.title}</h4>
                    <p className="text-xs font-semibold text-emerald-700 font-mono mt-0.5">
                      {prod.price_str}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({prod.price_timestamp})
                      </span>
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono">ASIN: {prod.asin}</span>
                  </div>
                  <button
                    onClick={() => handleImportProduct(prod)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Import
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Library Grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 px-1">
          Creator Product Library ({products.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="p-4.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 group hover:border-slate-300 transition"
            >
              <div className="flex items-start gap-3">
                <img
                  src={prod.image_url}
                  alt={prod.title}
                  className="w-20 h-20 rounded-xl object-cover bg-slate-50 border border-slate-200 flex-shrink-0 shadow-2xs"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60 font-semibold">
                      {prod.asin}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                      {prod.availability}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                    {prod.title}
                  </h4>
                  <p className="text-xs font-bold text-slate-900 font-mono mt-1">
                    {prod.price_str}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {prod.price_timestamp}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">
                  Tag: <span className="font-mono text-slate-800 font-semibold">{partnerTag}</span>
                </span>
                <a
                  href={`${prod.product_url}?tag=${partnerTag}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Amazon Link <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CSV Earnings Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              Import Amazon Associates Earnings Report (CSV)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Paste lines from your Amazon Associates Earnings Report CSV (Date, ASIN, Product Title, Items Ordered, Items Shipped, Revenue, Commission).
            </p>

            {importCount !== null && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" /> Successfully imported {importCount} rows!
              </div>
            )}

            <form onSubmit={handleCsvImport} className="space-y-4">
              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`Date,ASIN,Product Title,Items Ordered,Items Shipped,Revenue,Commission\n2026-11-12,B0D3G78JKL,Motorola Edge 50 Fusion,4,4,91996.0,2299.9`}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500 leading-relaxed"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition shadow-xs"
                >
                  Import Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
