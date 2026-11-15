import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api';
import type { BioPage, BioBlock, Creator } from '../../shared/types';
import { Spinner } from '../components/ui';

// Fan-facing page. Quiet dark graphite; the creator's accent appears only on the
// primary link border, link hover and the buy button. Mirrors the server-rendered page.
const PAGE = {
  bg: '#111214',
  fg: '#ededed',
  fg2: '#a1a1a6',
  line: 'rgba(255,255,255,0.08)',
  raised: 'rgba(255,255,255,0.04)',
};

/** Dark or light ink for text set on the accent color */
function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return '#111214';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.18 ? '#111214' : '#ffffff';
}

function parseJson<T>(raw: string | undefined | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const Shell: React.FC<{ children: React.ReactNode; accent?: string }> = ({ children, accent }) => (
  <div
    className="min-h-screen flex justify-center px-4 pt-16 pb-10"
    style={
      {
        background: PAGE.bg,
        color: PAGE.fg,
        fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
        '--accent': accent || PAGE.fg,
      } as React.CSSProperties
    }
  >
    {children}
  </div>
);

export const PublicBioPage: React.FC<{ handle?: string }> = ({ handle }) => {
  const [loading, setLoading] = useState(true);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [bioPage, setBioPage] = useState<BioPage | null>(null);
  const [blocks, setBlocks] = useState<BioBlock[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.bio.getMe();
        setCreator(res.creator);
        setBioPage(res.bioPage);
        setBlocks(res.blocks || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not load this page';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [handle]);

  if (loading) {
    return (
      <Shell>
        <div className="self-center" style={{ color: PAGE.fg2 }} role="status">
          <Spinner size={20} />
          <span className="sr-only">Loading</span>
        </div>
      </Shell>
    );
  }

  if (error || !bioPage) {
    return (
      <Shell>
        <main className="self-center text-center max-w-sm">
          <h1 className="text-[20px] leading-7 font-medium">
            {handle ? <span className="font-mono">@{handle}</span> : 'This page'} is not here
          </h1>
          <p className="mt-2 text-[14px] leading-5" style={{ color: PAGE.fg2 }}>
            The handle may have changed, or the page is not published yet
          </p>
          <a
            href="/"
            className="mt-6 inline-flex items-center h-9 px-4 rounded-[8px] text-[14px] transition-colors hover:bg-white/5"
            style={{ border: `1px solid ${PAGE.line}` }}
          >
            Go to CreatorBrain
          </a>
        </main>
      </Shell>
    );
  }

  const accent = bioPage.accent_color || PAGE.fg;
  const name = bioPage.custom_title || creator?.name || '';
  const bio = bioPage.custom_bio || creator?.bio || '';
  const active = blocks.filter((b) => b.is_active).sort((a, b) => a.order_index - b.order_index);
  const firstLinkId = active.find((b) => b.type === 'link')?.id;
  const hasProducts = active.some((b) => b.type === 'product_card');

  return (
    <Shell accent={accent}>
      <div className="w-full max-w-[480px] flex flex-col">
        {/* Profile */}
        <header className="flex flex-col items-center text-center">
          {creator?.avatar_url ? (
            <img src={creator.avatar_url} alt={`${name}'s profile photo`} width={80} height={80} className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-[28px] font-medium"
              style={{ background: PAGE.raised, border: `1px solid ${PAGE.line}` }}
              aria-hidden="true"
            >
              {name.slice(0, 1)}
            </div>
          )}
          <h1 className="mt-4 text-[20px] leading-7 font-medium">{name}</h1>
          {creator?.handle && (
            <div className="font-mono text-[13px] leading-5" style={{ color: PAGE.fg2 }}>
              @{creator.handle}
            </div>
          )}
          {bio && (
            <p className="mt-3 text-[14px] leading-[22px] max-w-sm" style={{ color: PAGE.fg2 }}>
              {bio}
            </p>
          )}
        </header>

        {/* Blocks */}
        <main className="mt-8 flex flex-col gap-3">
          {active.map((block) => {
            if (block.type === 'link') {
              const primary = block.id === firstLinkId;
              return (
                <a
                  key={block.id}
                  href={block.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center justify-between gap-3 h-14 px-5 rounded-[12px] border text-[15px] transition-colors hover:border-[var(--accent)] ${
                    primary ? 'border-[var(--accent)]' : 'border-white/8'
                  }`}
                  style={{ background: PAGE.raised }}
                >
                  <span className="truncate">
                    {block.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                  <ArrowUpRight size={16} strokeWidth={1.5} className="shrink-0" style={{ color: PAGE.fg2 }} aria-hidden="true" />
                </a>
              );
            }

            if (block.type === 'product_card') {
              const prod = block.product;
              return (
                <div
                  key={block.id}
                  className="flex items-center gap-4 p-3 rounded-[12px]"
                  style={{ background: PAGE.raised, border: `1px solid ${PAGE.line}` }}
                >
                  {prod?.image_url && (
                    <img
                      src={prod.image_url}
                      alt={block.title || prod?.title || 'Product'}
                      width={64}
                      height={64}
                      loading="lazy"
                      className="w-16 h-16 object-contain rounded-[8px] bg-white p-1 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] leading-5 truncate">{block.title || prod?.title}</div>
                    {prod?.price_str && (
                      <div className="mt-1 font-mono text-[13px] leading-5 tabular-nums">{prod.price_str}</div>
                    )}
                    {prod?.price_timestamp && (
                      <div className="font-mono text-[11px] leading-4" style={{ color: PAGE.fg2 }}>
                        Price as of {new Date(prod.price_timestamp).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {block.url && (
                    <a
                      href={block.url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-9 px-4 rounded-[8px] text-[14px] font-medium inline-flex items-center shrink-0 transition-opacity hover:opacity-90"
                      style={{ background: accent, color: inkOn(accent) }}
                    >
                      Buy
                      <span className="sr-only"> {block.title || prod?.title} (opens in a new tab)</span>
                    </a>
                  )}
                </div>
              );
            }

            if (block.type === 'social_links') {
              const socials = parseJson<Record<string, string>>(block.content_json) || {};
              const entries = Object.entries(socials);
              if (!entries.length) return null;
              return (
                <div key={block.id} className="flex flex-wrap justify-center gap-2 py-1">
                  {entries.map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 px-3 rounded-[8px] text-[13px] inline-flex items-center capitalize transition-colors hover:bg-white/5"
                      style={{ border: `1px solid ${PAGE.line}`, color: PAGE.fg2 }}
                    >
                      {platform}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ))}
                </div>
              );
            }

            if (block.type === 'text') {
              const text = parseJson<{ text?: string }>(block.content_json)?.text || block.title;
              return (
                <p key={block.id} className="px-2 py-1 text-[14px] leading-[22px] text-center" style={{ color: PAGE.fg2 }}>
                  {text}
                </p>
              );
            }

            if (block.type === 'divider') {
              return <hr key={block.id} aria-hidden="true" className="my-2 border-0 h-px" style={{ background: PAGE.line }} />;
            }

            return null;
          })}
        </main>

        {/* Disclosure and footer */}
        <footer className="mt-12 pt-6 text-center" style={{ borderTop: `1px solid ${PAGE.line}` }}>
          {hasProducts && (
            <p className="text-[12px] leading-[18px] max-w-xs mx-auto mb-4" style={{ color: PAGE.fg2 }}>
              As an Amazon Associate I earn from qualifying purchases. Prices and availability are accurate as of the
              date shown and may change.
            </p>
          )}
          <a href="/" className="text-[12px] text-[#a1a1a6] transition-colors hover:text-[#ededed]">
            Made with CreatorBrain
          </a>
        </footer>
      </div>
    </Shell>
  );
};
