import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { BioPage, BioBlock, Creator } from '../../shared/types';

export const PublicBioPage: React.FC<{ handle?: string }> = ({ handle = 'techkabir' }) => {
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
        const msg = err instanceof Error ? err.message : 'Failed to load creator bio page';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-2" />
      </div>
    );
  }

  if (error || !bioPage) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center text-slate-800 p-4 text-center">
        <h1 className="text-xl font-bold mb-2">Creator @{handle} Not Found</h1>
        <p className="text-slate-500 text-xs mb-4">The bio page you requested could not be retrieved.</p>
        <a href="/" className="px-4 py-2 bg-slate-900 rounded-xl text-white text-xs font-semibold">
          Return to Dashboard
        </a>
      </div>
    );
  }

  const themeClasses: Record<string, string> = {
    'minimal-dark': 'bg-[#ffffff] text-slate-900',
    'dna-accent': 'bg-[#fafaf9] text-slate-900',
    'cyber-neon': 'bg-rose-50/30 text-slate-900',
    'warm-editorial': 'bg-amber-50/40 text-slate-900',
  };

  const activeTheme = themeClasses[bioPage.theme] || themeClasses['dna-accent'];

  return (
    <div className={`min-h-screen ${activeTheme} flex justify-center py-12 px-4 canvas-grid`}>
      <div className="max-w-md w-full space-y-6">
        {/* Creator Profile */}
        <div className="text-center space-y-3">
          {creator?.avatar_url ? (
            <img
              src={creator.avatar_url}
              alt={creator.name}
              className="w-24 h-24 rounded-full mx-auto border-2 border-indigo-600/30 object-cover shadow-md"
            />
          ) : (
            <div className="w-24 h-24 rounded-full mx-auto bg-indigo-50 border-2 border-indigo-600 flex items-center justify-center text-2xl font-bold text-indigo-700">
              {creator?.name?.slice(0, 1) || 'K'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900">{bioPage.custom_title || creator?.name}</h1>
            <p className="text-xs text-indigo-700 font-mono font-medium mt-0.5">@{creator?.handle}</p>
          </div>
          {bioPage.custom_bio && (
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">{bioPage.custom_bio}</p>
          )}
        </div>

        {/* Blocks */}
        <div className="space-y-3 pt-2">
          {blocks
            .filter((b) => b.is_active)
            .sort((a, b) => a.order_index - b.order_index)
            .map((block) => {
              if (block.type === 'link') {
                return (
                  <a
                    key={block.id}
                    href={block.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-center font-semibold text-xs text-slate-900 transition shadow-xs hover:border-slate-300 active:scale-[0.99]"
                  >
                    {block.title}
                  </a>
                );
              }

              if (block.type === 'product_card') {
                const prod = block.product;
                return (
                  <div
                    key={block.id}
                    className="p-4 bg-white border border-slate-200/90 rounded-2xl flex items-center gap-3.5 shadow-xs hover:border-slate-300 transition"
                  >
                    {prod?.image_url && (
                      <img
                        src={prod.image_url}
                        alt={prod.title}
                        className="w-16 h-16 object-contain rounded-xl bg-slate-50 p-1 border border-slate-200 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{block.title || prod?.title}</h4>
                      {prod?.price_str && (
                        <p className="text-xs font-semibold text-slate-900 font-mono mt-0.5">{prod.price_str}</p>
                      )}
                      {prod?.price_timestamp && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Price valid as of {new Date(prod.price_timestamp).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {block.url && (
                      <a
                        href={block.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shrink-0 shadow-2xs"
                      >
                        Buy Now
                      </a>
                    )}
                  </div>
                );
              }

              if (block.type === 'text') {
                return (
                  <div key={block.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 text-center shadow-2xs">
                    {block.title}
                  </div>
                );
              }

              if (block.type === 'divider') {
                return <hr key={block.id} className="border-slate-200 my-4" />;
              }

              return null;
            })}
        </div>

        {/* Affiliate Disclosure & Footer */}
        <div className="pt-6 border-t border-slate-200 text-center space-y-2">
          <p className="text-[10px] text-slate-500 italic max-w-xs mx-auto">
            "As an Amazon Associate I earn from qualifying purchases. Product prices and availability are accurate as of the date/time indicated."
          </p>
          <div className="pt-2 text-[10px] text-slate-400 font-mono">
            Powered by <span className="text-indigo-600 font-bold">CreatorBrain</span> • Cloudflare Free Tier
          </div>
        </div>
      </div>
    </div>
  );
};
