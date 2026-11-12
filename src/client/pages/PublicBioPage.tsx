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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-2" />
      </div>
    );
  }

  if (error || !bioPage) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Creator @{handle} Not Found</h1>
        <p className="text-slate-500 text-sm mb-4">The bio page you requested could not be retrieved.</p>
        <a href="/" className="px-4 py-2 bg-indigo-600 rounded-lg text-white text-xs font-semibold">
          Return to Dashboard
        </a>
      </div>
    );
  }

  const themeClasses: Record<string, string> = {
    'minimal-dark': 'bg-slate-950 text-slate-100',
    'dna-accent': 'bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 text-white',
    'cyber-neon': 'bg-black text-cyan-400 font-mono',
    'warm-editorial': 'bg-[#181412] text-amber-50',
  };

  const activeTheme = themeClasses[bioPage.theme] || themeClasses['dna-accent'];

  return (
    <div className={`min-h-screen ${activeTheme} flex justify-center py-12 px-4`}>
      <div className="max-w-md w-full space-y-6">
        {/* Creator Profile */}
        <div className="text-center space-y-3">
          {creator?.avatar_url ? (
            <img
              src={creator.avatar_url}
              alt={creator.name}
              className="w-24 h-24 rounded-full mx-auto border-2 border-indigo-500/40 object-cover shadow-xl"
            />
          ) : (
            <div className="w-24 h-24 rounded-full mx-auto bg-indigo-600/30 border-2 border-indigo-500 flex items-center justify-center text-2xl font-bold">
              {creator?.name?.slice(0, 1) || 'K'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{bioPage.custom_title || creator?.name}</h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">@{creator?.handle}</p>
          </div>
          {bioPage.custom_bio && (
            <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">{bioPage.custom_bio}</p>
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
                    className="block p-3.5 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 rounded-xl text-center font-medium text-xs transition shadow-sm hover:border-slate-700 active:scale-[0.99]"
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
                    className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-3 shadow-sm hover:border-slate-700 transition"
                  >
                    {prod?.image_url && (
                      <img
                        src={prod.image_url}
                        alt={prod.title}
                        className="w-16 h-16 object-contain rounded-lg bg-slate-950 p-1 border border-slate-800 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate">{block.title || prod?.title}</h4>
                      {prod?.price_str && (
                        <p className="text-[11px] text-slate-400 truncate">{prod.price_str}</p>
                      )}
                      {prod?.price_timestamp && (
                        <p className="text-[9px] text-slate-500">
                          Price valid as of {new Date(prod.price_timestamp).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {block.url && (
                      <a
                        href={block.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition shrink-0"
                      >
                        Buy Now
                      </a>
                    )}
                  </div>
                );
              }

              if (block.type === 'text') {
                return (
                  <div key={block.id} className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl text-xs text-slate-300 text-center">
                    {block.title}
                  </div>
                );
              }

              if (block.type === 'divider') {
                return <hr key={block.id} className="border-slate-800 my-4" />;
              }

              return null;
            })}
        </div>

        {/* Affiliate Disclosure & Footer */}
        <div className="pt-6 border-t border-slate-800/80 text-center space-y-2">
          <p className="text-[10px] text-slate-500 italic max-w-xs mx-auto">
            "As an Amazon Associate I earn from qualifying purchases. Product prices and availability are accurate as of the date/time indicated."
          </p>
          <div className="pt-2 text-[10px] text-slate-600 font-mono">
            Powered by <span className="text-indigo-400 font-bold">CreatorBrain</span> • Cloudflare Free Tier
          </div>
        </div>
      </div>
    </div>
  );
};
