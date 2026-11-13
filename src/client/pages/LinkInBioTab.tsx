import React, { useEffect, useState } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  QrCode,
  Save,
  Check,
  Sparkles,
  ShoppingBag,
  Share2,
  Type,
  Minus,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Creator, BioPage, BioBlock, BioBlockType } from '../../shared/types';

interface LinkInBioTabProps {
  creator?: Creator | null;
}

export const LinkInBioTab: React.FC<LinkInBioTabProps> = ({ creator }) => {
  const [bioPage, setBioPage] = useState<BioPage | null>(null);
  const [blocks, setBlocks] = useState<BioBlock[]>([]);
  const [_loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Add block modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBlockType, setNewBlockType] = useState<BioBlockType>('link');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    loadBioData();
  }, []);

  const loadBioData = async () => {
    setLoading(true);
    try {
      const res = await api.bio.getMe();
      setBioPage(res.bioPage);
      setBlocks(res.blocks || []);
    } catch (err: unknown) {
      console.error('Failed to load bio data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    // Update order_index
    const reindexed = updated.map((b, i) => ({ ...b, order_index: i }));
    setBlocks(reindexed);
  };

  const handleDeleteBlock = (index: number) => {
    const updated = blocks.filter((_, i) => i !== index);
    setBlocks(updated);
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newBlock: BioBlock = {
      id: `block_temp_${Date.now()}`,
      bio_page_id: bioPage?.id || 'bio_1',
      type: newBlockType,
      title: newTitle.trim(),
      url: newUrl.trim() || undefined,
      order_index: blocks.length,
      is_active: 1,
      clicks_count: 0,
      created_at: new Date().toISOString(),
    };

    setBlocks([...blocks, newBlock]);
    setShowAddModal(false);
    setNewTitle('');
    setNewUrl('');
  };

  const handleSaveChanges = async () => {
    if (!bioPage) return;
    try {
      await Promise.all([
        api.bio.updatePage(bioPage),
        api.bio.updateBlocks(blocks),
      ]);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save bio changes:', err);
    }
  };

  const publicUrl = creator ? `/@${creator.handle}` : '/@demo';

  // SVG QR Code generator (inline simple matrix for clean visual)
  const renderInlineQr = () => (
    <svg viewBox="0 0 100 100" className="w-48 h-48 mx-auto rounded-xl bg-white p-3 shadow-md border border-slate-200">
      <path
        d="M 10 10 h 25 v 25 h -25 z M 15 15 v 15 h 15 v -15 z M 20 20 h 5 v 5 h -5 z M 65 10 h 25 v 25 h -25 z M 70 15 v 15 h 15 v -15 z M 75 20 h 5 v 5 h -5 z M 10 65 h 25 v 25 h -25 z M 15 70 v 15 h 15 v -15 z M 20 75 h 5 v 5 h -5 z M 45 10 h 10 v 15 h -10 z M 45 35 h 10 v 10 h -10 z M 10 45 h 15 v 10 h -15 z M 35 45 h 30 v 10 h -30 z M 75 45 h 15 v 10 h -15 z M 45 65 h 10 v 25 h -10 z M 65 65 h 25 v 10 h -25 z M 75 80 h 15 v 10 h -15 z"
        fill="#0f172a"
      />
    </svg>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Link-in-Bio Page Builder
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Public edge-rendered page at <span className="text-indigo-600 font-mono font-medium">{publicUrl}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQrModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition"
          >
            <QrCode className="w-3.5 h-3.5 text-slate-600" />
            View QR Code
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition"
          >
            Open Live Page
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={handleSaveChanges}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs active:scale-95"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Saved & Cached!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Builder Grid: Left Editor & Right Live Phone Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Theme & Block Editor (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Theme & Styling Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Theme & DNA Color Palette
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'dna-accent' as const, label: 'DNA Indigo', accent: '#4f46e5', bg: '#f8fafc' },
                { id: 'minimal-dark' as const, label: 'Minimal Slate', accent: '#0f172a', bg: '#ffffff' },
                { id: 'cyber-neon' as const, label: 'Electric Rose', accent: '#e11d48', bg: '#fafaf9' },
                { id: 'warm-editorial' as const, label: 'Warm Amber', accent: '#d97706', bg: '#fffbeb' },
              ].map((th) => (
                <button
                  key={th.id}
                  onClick={() =>
                    setBioPage((prev) =>
                      prev ? { ...prev, theme: th.id, accent_color: th.accent, bg_color: th.bg } : null
                    )
                  }
                  className={`p-3 rounded-xl border text-left transition-all ${
                    bioPage?.theme === th.id
                      ? 'border-indigo-500 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-200'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-3.5 h-3.5 rounded-full" style={{ background: th.accent }} />
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ background: th.bg }} />
                  </div>
                  <span className="text-xs font-bold text-slate-900 block">{th.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Title</label>
                <input
                  type="text"
                  value={bioPage?.custom_title || ''}
                  onChange={(e) =>
                    setBioPage((prev) => (prev ? { ...prev, custom_title: e.target.value } : null))
                  }
                  placeholder={creator?.name || 'Your Name'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Bio</label>
                <input
                  type="text"
                  value={bioPage?.custom_bio || ''}
                  onChange={(e) =>
                    setBioPage((prev) => (prev ? { ...prev, custom_bio: e.target.value } : null))
                  }
                  placeholder="Short tagline..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Block Items Editor Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Page Blocks ({blocks.length})
              </h3>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Block
              </button>
            </div>

            <div className="space-y-2.5">
              {blocks.map((block, idx) => (
                <div
                  key={block.id || idx}
                  className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs text-slate-600">
                      {block.type === 'product_card' ? (
                        <ShoppingBag className="w-4 h-4 text-indigo-600" />
                      ) : block.type === 'social_links' ? (
                        <Share2 className="w-4 h-4 text-purple-600" />
                      ) : block.type === 'text' ? (
                        <Type className="w-4 h-4 text-amber-600" />
                      ) : block.type === 'divider' ? (
                        <Minus className="w-4 h-4 text-slate-400" />
                      ) : (
                        <Globe className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {block.title || block.product?.title || block.type.toUpperCase()}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {block.clicks_count} clicks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{block.url || 'Internal'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleMoveBlock(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move block up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveBlock(idx, 'down')}
                      disabled={idx === blocks.length - 1}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move block down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBlock(idx)}
                      className="p-1.5 rounded text-rose-500 hover:text-rose-700 ml-1"
                      aria-label="Delete block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Mobile Preview Frame (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-[340px] rounded-[44px] border-8 border-slate-800 bg-white p-3 shadow-2xl relative overflow-hidden">
            {/* Phone Speaker Notch */}
            <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-3" />

            {/* Inner Phone Screen Content */}
            <div
              className="rounded-[32px] p-5 min-h-[500px] flex flex-col items-center gap-3 transition-colors duration-300 border border-slate-100"
              style={{
                background: bioPage?.bg_color || '#fafaf9',
                color: '#0f172a',
              }}
            >
              <img
                src={creator?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'}
                alt="Creator Avatar"
                className="w-16 h-16 rounded-full border-2 object-cover shadow-sm"
                style={{ borderColor: bioPage?.accent_color || '#4f46e5' }}
              />
              <h3 className="text-sm font-bold text-center text-slate-900">
                {bioPage?.custom_title || creator?.name || 'Creator'}
              </h3>
              <p className="text-[11px] text-center text-slate-500 max-w-[220px]">
                {bioPage?.custom_bio || creator?.bio || ''}
              </p>

              {/* Previewed Blocks */}
              <div className="w-full space-y-2 mt-2 overflow-y-auto max-h-[340px] pr-1">
                {blocks
                  .filter((b) => b.is_active)
                  .map((b, i) => (
                    <div
                      key={b.id || i}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs text-xs font-semibold flex items-center justify-between text-slate-800 hover:border-slate-300 transition"
                    >
                      <span className="truncate">{b.title || b.product?.title || 'Link'}</span>
                      <span style={{ color: bioPage?.accent_color || '#4f46e5' }}>→</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 mt-3 font-medium">Live Edge Preview</span>
        </div>
      </div>

      {/* Add Block Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Bio Block</h3>
            <form onSubmit={handleAddBlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Block Type</label>
                <select
                  value={newBlockType}
                  onChange={(e) => setNewBlockType(e.target.value as BioBlockType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="link">Custom Web Link</option>
                  <option value="product_card">Product Card</option>
                  <option value="social_links">Social Links</option>
                  <option value="text">Announcement / Text</option>
                  <option value="divider">Divider</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title / Label</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. My Favorite Studio Gear 2026"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target URL</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition shadow-xs"
                >
                  Add Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-xl text-center space-y-4">
            <h3 className="text-base font-bold text-slate-900">Share Your Link-in-Bio</h3>
            {renderInlineQr()}
            <p className="text-xs font-mono text-indigo-600 font-semibold">{publicUrl}</p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
