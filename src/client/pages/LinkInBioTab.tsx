import React, { useEffect, useState } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ExternalLink,
  QrCode,
  Save,
  Check,
  ShoppingBag,
  Share2,
  Type,
  Minus,
  Copy,
  X,
  Pencil,
} from 'lucide-react';
import { api } from '../lib/api';
import { automaticLinkIcon } from '../../shared/bio';
import type { Creator, BioPage, BioBlock, BioBlockType } from '../../shared/types';
import { ICON, PageHeader, SectionTitle, EmptyState, ErrorNote, Spinner, Dialog, formatCount } from '../components/ui';

interface LinkInBioTabProps {
  creator?: Creator | null;
}

// Public page palette (kept in sync with PublicBioPage and the server-rendered page)
const PAGE = {
  bg: '#111214',
  fg: '#ededed',
  fg2: '#a1a1a6',
  line: 'rgba(255,255,255,0.08)',
  raised: 'rgba(255,255,255,0.04)',
};

const ACCENTS = [
  { id: 'dna-accent' as const, label: 'Cobalt', accent: '#5b7cfa', bg: '#111214' },
  { id: 'minimal-dark' as const, label: 'Paper', accent: '#ededed', bg: '#111214' },
  { id: 'cyber-neon' as const, label: 'Rose', accent: '#f43f5e', bg: '#111214' },
  { id: 'warm-editorial' as const, label: 'Amber', accent: '#f59e0b', bg: '#111214' },
];

/** Dark or light ink for text set on the accent color */
function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#111214';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.18 ? '#111214' : '#ffffff';
}

const blockIcon = (type: BioBlockType) => {
  switch (type) {
    case 'product_card':
      return <ShoppingBag {...ICON} />;
    case 'social_links':
      return <Share2 {...ICON} />;
    case 'text':
      return <Type {...ICON} />;
    case 'divider':
      return <Minus {...ICON} />;
    default:
      return <Globe {...ICON} />;
  }
};

const blockTypeLabel: Record<BioBlockType, string> = {
  link: 'Link',
  product_card: 'Product',
  social_links: 'Social links',
  text: 'Text',
  divider: 'Divider',
};

const LinkBlockIcon: React.FC<{ url?: string; iconUrl?: string; className?: string }> = ({
  url,
  iconUrl,
  className = 'w-8 h-8',
}) => {
  const automatic = automaticLinkIcon(url);
  const source = iconUrl || automatic;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <span className={`${className} rounded-[8px] bg-raised text-fg-2 flex items-center justify-center shrink-0 overflow-hidden`}>
      {source && source !== failedSource ? (
        <img src={source} alt="" className="w-full h-full object-contain p-1" onError={() => setFailedSource(source)} />
      ) : (
        <Globe {...ICON} />
      )}
    </span>
  );
};

/** What fans see, drawn inside the phone frame */
const PhonePreview: React.FC<{ creator?: Creator | null; bioPage: BioPage | null; blocks: BioBlock[] }> = ({
  creator,
  bioPage,
  blocks,
}) => {
  const accent = bioPage?.accent_color || ACCENTS[0].accent;
  const name = bioPage?.custom_title || creator?.name || 'Your name';
  const bio = bioPage?.custom_bio || creator?.bio || '';
  const handle = creator?.handle || bioPage?.handle;
  const active = blocks.filter((b) => b.is_active);
  const hasProducts = active.some((b) => b.type === 'product_card');

  return (
    <div
      className="h-full overflow-y-auto px-5 pt-12 pb-6 flex flex-col items-center"
      style={{ background: PAGE.bg, color: PAGE.fg }}
      role="region"
      aria-label="Preview of your public page"
      tabIndex={0}
    >
      {creator?.avatar_url ? (
        <img
          src={creator.avatar_url}
          alt={`${name}'s avatar`}
          width={64}
          height={64}
          className="w-16 h-16 rounded-full object-cover"
        />
      ) : (
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-medium"
          style={{ background: PAGE.raised, border: `1px solid ${PAGE.line}` }}
        >
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="mt-3 text-[16px] leading-6 font-medium text-center">{name}</div>
      {handle && (
        <div className="font-mono text-[12px] leading-4" style={{ color: PAGE.fg2 }}>
          @{handle}
        </div>
      )}
      {bio && (
        <p className="mt-2 text-[12px] leading-[18px] text-center max-w-[240px]" style={{ color: PAGE.fg2 }}>
          {bio}
        </p>
      )}

      <div className="w-full mt-6 flex flex-col gap-2">
        {active.length === 0 && (
          <div className="text-center text-[12px] py-6" style={{ color: PAGE.fg2 }}>
            Add a block to see it here
          </div>
        )}
        {active.map((b, i) => {
          const key = b.id || i;
          if (b.type === 'divider') {
            return <div key={key} className="my-2 h-px w-full" style={{ background: PAGE.line }} />;
          }
          if (b.type === 'text') {
            return (
              <p key={key} className="text-[12px] leading-[18px] text-center px-2 py-1" style={{ color: PAGE.fg2 }}>
                {b.title}
              </p>
            );
          }
          if (b.type === 'social_links') {
            return (
              <div key={key} className="flex justify-center gap-2 py-1">
                <span
                  className="h-7 px-3 rounded-[8px] text-[12px] flex items-center"
                  style={{ border: `1px solid ${PAGE.line}`, color: PAGE.fg2 }}
                >
                  {b.title || 'Social links'}
                </span>
              </div>
            );
          }
          if (b.type === 'product_card') {
            const p = b.product;
            return (
              <div
                key={key}
                className="w-full rounded-[12px] p-3 flex items-center gap-3"
                style={{ background: PAGE.raised, border: `1px solid ${PAGE.line}` }}
              >
                {p?.image_url ? (
                  <img
                    src={p.image_url}
                    alt={b.title || p?.title || 'Product'}
                    width={48}
                    height={48}
                    loading="lazy"
                    className="w-12 h-12 rounded-[8px] object-contain bg-white p-1 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-[8px] shrink-0" style={{ background: PAGE.line }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] leading-4 truncate">{b.title || p?.title || 'Product'}</div>
                  {p?.price_str && (
                    <div className="font-mono text-[12px] leading-4 mt-1" style={{ color: PAGE.fg2 }}>
                      {p.price_str}
                    </div>
                  )}
                </div>
                <span
                  className="h-7 px-3 rounded-[8px] text-[12px] font-medium flex items-center shrink-0"
                  style={{ background: accent, color: inkOn(accent) }}
                >
                  Buy
                </span>
              </div>
            );
          }
          return (
            <div
              key={key}
              className="w-full h-11 px-4 rounded-[12px] text-[13px] flex items-center justify-between gap-2"
              style={{
                background: PAGE.raised,
                border: `1px solid ${i === 0 ? accent : PAGE.line}`,
              }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <LinkBlockIcon url={b.url} iconUrl={b.icon_url} className="w-7 h-7" />
                <span className="truncate">{b.title || 'Link'}</span>
              </span>
              <ArrowUpRight
                size={14}
                strokeWidth={1.5}
                className="shrink-0"
                style={{ color: PAGE.fg2 }}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-8 text-center">
        {hasProducts && (
          <p className="text-[10px] leading-[14px] mb-2 max-w-[240px]" style={{ color: PAGE.fg2 }}>
            As an Amazon Associate I earn from qualifying purchases
          </p>
        )}
        <span className="text-[11px]" style={{ color: PAGE.fg2 }}>
          Made with CreatorBrain
        </span>
      </div>
    </div>
  );
};

export const LinkInBioTab: React.FC<LinkInBioTabProps> = ({ creator }) => {
  const [bioPage, setBioPage] = useState<BioPage | null>(null);
  const [blocks, setBlocks] = useState<BioBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Add block modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBlockType, setNewBlockType] = useState<BioBlockType>('link');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIconUrl, setNewIconUrl] = useState('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [iconUploading, setIconUploading] = useState(false);

  useEffect(() => {
    loadBioData();
  }, []);

  const loadBioData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.bio.getMe();
      setBioPage(res.bioPage);
      setBlocks(res.blocks || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load your bio page');
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

    if (editingBlockId) {
      setBlocks((current) =>
        current.map((block) =>
          block.id === editingBlockId
            ? {
                ...block,
                title: newTitle.trim(),
                url: newUrl.trim() || undefined,
                icon_url: newIconUrl || undefined,
              }
            : block
        )
      );
      setShowAddModal(false);
      setEditingBlockId(null);
      setNewTitle('');
      setNewUrl('');
      setNewIconUrl('');
      return;
    }

    const newBlock: BioBlock = {
      id: `block_temp_${Date.now()}`,
      bio_page_id: bioPage?.id || 'bio_1',
      type: newBlockType,
      title: newTitle.trim(),
      url: newUrl.trim() || undefined,
      icon_url: newBlockType === 'link' ? newIconUrl || undefined : undefined,
      order_index: blocks.length,
      is_active: 1,
      clicks_count: 0,
      created_at: new Date().toISOString(),
    };

    setBlocks([...blocks, newBlock]);
    setShowAddModal(false);
    setNewTitle('');
    setNewUrl('');
    setNewIconUrl('');
  };

  const openAddBlock = () => {
    setEditingBlockId(null);
    setNewBlockType('link');
    setNewTitle('');
    setNewUrl('');
    setNewIconUrl('');
    setShowAddModal(true);
  };

  const openEditLink = (block: BioBlock) => {
    setEditingBlockId(block.id);
    setNewBlockType('link');
    setNewTitle(block.title || '');
    setNewUrl(block.url || '');
    setNewIconUrl(block.icon_url || '');
    setShowAddModal(true);
  };

  const handleUploadIcon = async (file?: File) => {
    if (!file) return;
    setError(null);
    setIconUploading(true);
    try {
      const uploaded = await api.bio.uploadIcon(file);
      if (newIconUrl && !blocks.some((block) => block.icon_url === newIconUrl)) {
        await api.bio.deleteUnsavedIcon(newIconUrl).catch(() => undefined);
      }
      setNewIconUrl(uploaded.iconUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not upload this icon');
    } finally {
      setIconUploading(false);
    }
  };

  const closeBlockDialog = () => {
    if (newIconUrl && !blocks.some((block) => block.icon_url === newIconUrl)) {
      void api.bio.deleteUnsavedIcon(newIconUrl).catch(() => undefined);
    }
    setShowAddModal(false);
    setEditingBlockId(null);
    setNewTitle('');
    setNewUrl('');
    setNewIconUrl('');
  };

  const useSiteIcon = () => {
    if (newIconUrl && !blocks.some((block) => block.icon_url === newIconUrl)) {
      void api.bio.deleteUnsavedIcon(newIconUrl).catch(() => undefined);
    }
    setNewIconUrl('');
  };

  const handleSaveChanges = async () => {
    if (!bioPage) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all([api.bio.updatePage(bioPage), api.bio.updateBlocks(blocks)]);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes');
    } finally {
      setSaving(false);
    }
  };

  const handle = creator?.handle || bioPage?.handle;
  const publicUrl = handle ? `/@${handle}` : '/';
  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : publicUrl;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <PageHeader
        title="Link in bio"
        description={
          <>
            The page fans open from your profiles, served at <span className="font-mono text-fg">{publicUrl}</span>
          </>
        }
        actions={
          <>
            <button onClick={() => setShowQrModal(true)} className="btn btn-ghost">
              <QrCode {...ICON} />
              QR code
            </button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Open page
              <span className="sr-only">(opens in a new tab)</span>
              <ExternalLink {...ICON} className="text-fg-3" />
            </a>
            <button
              onClick={handleSaveChanges}
              disabled={!bioPage || saving}
              aria-busy={saving}
              className="btn btn-primary"
            >
              {saving ? <Spinner /> : savedSuccess ? <Check {...ICON} /> : <Save {...ICON} />}
              {savedSuccess ? 'Saved' : 'Save changes'}
            </button>
          </>
        }
      />

      <p className="sr-only" role="status">
        {savedSuccess ? 'Changes saved' : ''}
      </p>

      {error && (
        <div className="mb-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Editor */}
        <div className="lg:col-span-7 space-y-8">
          <section>
            <SectionTitle title="Profile" />
            <div className="card p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label" htmlFor="bio-title">
                    Display name
                  </label>
                  <input
                    id="bio-title"
                    type="text"
                    value={bioPage?.custom_title || ''}
                    onChange={(e) => setBioPage((prev) => (prev ? { ...prev, custom_title: e.target.value } : null))}
                    placeholder={creator?.name || 'Your name'}
                    className="input"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="bio-tagline">
                    Tagline
                  </label>
                  <input
                    id="bio-tagline"
                    type="text"
                    value={bioPage?.custom_bio || ''}
                    onChange={(e) => setBioPage((prev) => (prev ? { ...prev, custom_bio: e.target.value } : null))}
                    placeholder={creator?.bio || 'One line about what you make'}
                    className="input"
                  />
                </div>
              </div>

              <div role="group" aria-labelledby="bio-accent-label" aria-describedby="bio-accent-hint">
                <div id="bio-accent-label" className="field-label">
                  Accent
                </div>
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((th) => {
                    const selected = bioPage?.theme === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setBioPage((prev) =>
                            prev ? { ...prev, theme: th.id, accent_color: th.accent, bg_color: th.bg } : null
                          )
                        }
                        className={`h-9 pl-2 pr-3 rounded-[8px] border flex items-center gap-2 text-[13px] transition-colors ${
                          selected
                            ? 'border-fg bg-surface text-fg'
                            : 'border-line-strong bg-surface text-fg-2 hover:bg-raised'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-[4px] flex items-center justify-center"
                          style={{ background: PAGE.bg }}
                          aria-hidden="true"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: th.accent }} />
                        </span>
                        {th.label}
                      </button>
                    );
                  })}
                </div>
                <p id="bio-accent-hint" className="field-hint">
                  Used for your first link and the buy button. The page itself stays dark
                </p>
              </div>
            </div>
          </section>

          <section>
            <SectionTitle
              title="Blocks"
              meta={blocks.length || undefined}
              action={
                <button type="button" onClick={openAddBlock} className="btn btn-secondary btn-sm">
                  <Plus {...ICON} />
                  Add block
                </button>
              }
            />
            <div className="card overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-fg-3" role="status">
                  <Spinner />
                  Loading blocks
                </div>
              ) : blocks.length === 0 ? (
                <EmptyState
                  icon={<Globe {...ICON} />}
                  title="No blocks yet"
                  description="Add links, products and short notes. They appear on your page in this order."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {blocks.map((block, idx) => {
                    const blockName = block.title || block.product?.title || blockTypeLabel[block.type];
                    return (
                      <li key={block.id || idx} className="flex items-center gap-3 px-4 py-3">
                        {block.type === 'link' ? (
                          <LinkBlockIcon url={block.url} iconUrl={block.icon_url} />
                        ) : (
                          <span
                            className="w-8 h-8 rounded-[8px] bg-raised text-fg-2 flex items-center justify-center shrink-0"
                            aria-hidden="true"
                          >
                            {blockIcon(block.type)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="text-fg truncate">
                              {block.title || block.product?.title || blockTypeLabel[block.type]}
                            </span>
                            <span className="meta shrink-0">{formatCount(block.clicks_count)} clicks</span>
                          </div>
                          <p className="text-[12px] leading-4 text-fg-3 truncate mt-1">
                            {blockTypeLabel[block.type]}
                            {block.url ? ` · ${block.url}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {block.type === 'link' && (
                            <button
                              type="button"
                              onClick={() => openEditLink(block)}
                              className="btn btn-ghost btn-sm !px-2"
                              aria-label={`Edit ${blockName}`}
                            >
                              <Pencil {...ICON} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(idx, 'up')}
                            disabled={idx === 0}
                            className="btn btn-ghost btn-sm !px-2"
                            aria-label={`Move ${blockName} up`}
                          >
                            <ArrowUp {...ICON} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(idx, 'down')}
                            disabled={idx === blocks.length - 1}
                            className="btn btn-ghost btn-sm !px-2"
                            aria-label={`Move ${blockName} down`}
                          >
                            <ArrowDown {...ICON} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(idx)}
                            className="btn btn-ghost btn-sm !px-2 hover:!text-negative"
                            aria-label={`Delete ${blockName}`}
                          >
                            <Trash2 {...ICON} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="field-hint">Changes show in the preview right away and go live when you save</p>
          </section>
        </div>

        {/* Preview */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 flex flex-col items-center">
          <div className="w-[320px] h-[640px] rounded-[44px] p-2 bg-[#1c1d20] shadow-[0_1px_2px_rgb(0_0_0/0.08),0_12px_32px_rgb(0_0_0/0.10)]">
            <div className="relative w-full h-full rounded-[36px] overflow-hidden">
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 rounded-full bg-black z-10"
                aria-hidden="true"
              />
              <PhonePreview creator={creator} bioPage={bioPage} blocks={blocks} />
            </div>
          </div>
          <div className="mt-3 meta">Preview · {publicUrl}</div>
        </div>
      </div>

      {/* Add block */}
      {showAddModal && (
        <Dialog
          onClose={closeBlockDialog}
          labelledBy="add-block-title"
          className="panel w-full max-w-md p-6"
          backdropClassName="bg-black/30"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id="add-block-title" className="text-[15px] font-medium text-fg">
              {editingBlockId ? 'Edit link' : 'Add block'}
            </h2>
            <button type="button" onClick={closeBlockDialog} className="btn btn-ghost btn-sm !px-2" aria-label="Close">
              <X {...ICON} />
            </button>
          </div>
          <form onSubmit={handleAddBlock} className="space-y-4">
            {!editingBlockId && (
              <div>
                <label className="field-label" htmlFor="nb-type">
                  Type
                </label>
                <select
                  id="nb-type"
                  value={newBlockType}
                  onChange={(e) => setNewBlockType(e.target.value as BioBlockType)}
                  className="input"
                >
                  <option value="link">Link</option>
                  <option value="product_card">Product card</option>
                  <option value="social_links">Social links</option>
                  <option value="text">Text</option>
                  <option value="divider">Divider</option>
                </select>
              </div>
            )}

            <div>
              <label className="field-label" htmlFor="nb-title">
                Title
              </label>
              <input
                id="nb-title"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Studio gear I use"
                className="input"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="nb-url">
                URL
              </label>
              <input
                id="nb-url"
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://"
                className="input"
              />
            </div>

            {newBlockType === 'link' && (
              <div className="space-y-2">
                <div>
                  <label className="field-label" htmlFor="nb-icon">
                    Link icon
                  </label>
                  <p className="field-hint mb-2">
                    We’ll load the site icon from this link automatically. You can upload your own PNG, JPG, or WebP instead.
                  </p>
                  <input
                    id="nb-icon"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={iconUploading}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = '';
                      void handleUploadIcon(file);
                    }}
                    className="input h-auto py-2"
                  />
                </div>
                {newIconUrl && (
                  <div className="flex items-center gap-3">
                    <LinkBlockIcon url={newUrl} iconUrl={newIconUrl} />
                    <span className="text-[12px] text-fg-2 flex-1">Custom icon ready</span>
                    <button type="button" onClick={useSiteIcon} className="btn btn-ghost btn-sm">
                      Use site icon
                    </button>
                  </div>
                )}
                {iconUploading && <p className="field-hint flex items-center gap-2"><Spinner size={14} /> Uploading icon to R2</p>}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={closeBlockDialog} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={iconUploading} className="btn btn-primary">
                {editingBlockId ? 'Save link' : 'Add block'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* QR code */}
      {showQrModal && (
        <Dialog
          onClose={() => setShowQrModal(false)}
          labelledBy="qr-title"
          className="panel w-full max-w-sm p-6"
          backdropClassName="bg-black/30"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id="qr-title" className="text-[15px] font-medium text-fg">
              QR code
            </h2>
            <button onClick={() => setShowQrModal(false)} className="btn btn-ghost btn-sm !px-2" aria-label="Close">
              <X {...ICON} />
            </button>
          </div>
          <div className="well p-4 flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&margin=8&data=${encodeURIComponent(fullUrl)}`}
              alt={`QR code for ${fullUrl}`}
              width={192}
              height={192}
              className="rounded-[4px] bg-white"
            />
          </div>
          <p className="mt-3 text-[13px] text-fg-2">Print it on packaging or show it at the end of a video</p>
          <div className="mt-4 flex items-center gap-2">
            <div className="input flex items-center font-mono text-[13px] text-fg-2 truncate">{fullUrl}</div>
            <button onClick={handleCopyUrl} className="btn btn-secondary shrink-0">
              {copied ? <Check {...ICON} className="text-positive" /> : <Copy {...ICON} />}
              <span role="status">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
};
