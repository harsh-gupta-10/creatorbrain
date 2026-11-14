import React from 'react';
import { Loader2 } from 'lucide-react';

// Shared building blocks for the CreatorBrain interface.
// Keep chrome quiet: graphite surfaces, one accent, lucide icons at 16px / 1.5 stroke.

export const ICON = { size: 16, strokeWidth: 1.5 } as const;

/** Signature detail: a five-step level meter for confidence and strength (0..1) */
export const Meter: React.FC<{ value: number; label?: string; className?: string }> = ({ value, label, className = '' }) => {
  const steps = 5;
  const lit = Math.max(0, Math.min(steps, Math.round(value * steps)));
  return (
    <span
      className={`inline-flex items-end gap-[2px] h-3 ${className}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-label={label || 'Confidence'}
      title={`${Math.round(value * 100)}%`}
    >
      {Array.from({ length: steps }, (_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-[1px] ${i < lit ? 'bg-accent' : 'bg-line-strong'}`}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </span>
  );
};

export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-2 ${className}`}>
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="0.5" y="0.5" width="19" height="19" rx="5" fill="#171717" />
      <rect x="5" y="10" width="2" height="5" rx="1" fill="#fff" />
      <rect x="9" y="7" width="2" height="8" rx="1" fill="#fff" />
      <rect x="13" y="4" width="2" height="11" rx="1" fill="#2f5bea" />
    </svg>
    <span className="text-[15px] font-medium tracking-[-0.01em] text-fg">CreatorBrain</span>
  </span>
);

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <Loader2 size={size} strokeWidth={1.5} className={`spin ${className}`} aria-hidden="true" />
);

export const PageHeader: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
    <div className="min-w-0">
      <h1 className="text-[24px] leading-[32px] font-medium tracking-[-0.01em] text-fg">{title}</h1>
      {description && <p className="mt-1 text-fg-2 max-w-2xl">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'negative';
}> = ({ label, value, note, tone = 'neutral' }) => (
  <div className="card p-5">
    <div className="text-[13px] text-fg-2">{label}</div>
    <div className="mt-2 text-[28px] leading-none font-medium num text-fg">{value}</div>
    {note && (
      <div
        className={`mt-2 text-[12px] leading-4 ${
          tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : 'text-fg-3'
        }`}
      >
        {note}
      </div>
    )}
  </div>
);

export const SectionTitle: React.FC<{ title: string; action?: React.ReactNode; meta?: React.ReactNode }> = ({
  title,
  action,
  meta,
}) => (
  <div className="flex items-center justify-between gap-4 mb-3">
    <div className="flex items-baseline gap-2 min-w-0">
      <h2 className="text-[15px] font-medium text-fg">{title}</h2>
      {meta && <span className="meta">{meta}</span>}
    </div>
    {action}
  </div>
);

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center text-center py-12 px-6">
    {icon && <div className="w-10 h-10 rounded-[10px] bg-raised text-fg-3 flex items-center justify-center mb-4">{icon}</div>}
    <div className="font-medium text-fg">{title}</div>
    {description && <p className="mt-1 text-fg-2 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="alert" className="rounded-[8px] bg-negative-soft text-negative text-[13px] px-3 py-2">
    {children}
  </div>
);

export const Segmented = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) => (
  <div className="inline-flex p-[2px] rounded-[8px] bg-raised">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`h-7 px-3 rounded-[6px] text-[13px] transition-colors ${
          value === o.value ? 'bg-surface text-fg shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-fg-2 hover:text-fg'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export function formatCount(n: number | undefined | null): string {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return v.toLocaleString('en-US');
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
