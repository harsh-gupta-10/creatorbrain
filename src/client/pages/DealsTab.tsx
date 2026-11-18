import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Handshake } from 'lucide-react';
import { api, ApiError, type BrandDeal, type DealInput, type DealStage } from '../lib/api';
import {
  PageHeader,
  Stat,
  SectionTitle,
  EmptyState,
  ErrorNote,
  Spinner,
  Dialog,
  ICON,
  formatDate,
} from '../components/ui';

type Currency = BrandDeal['currency'];

const STAGES: { value: DealStage; label: string }[] = [
  { value: 'talking', label: 'Talking' },
  { value: 'agreed', label: 'Agreed' },
  { value: 'posted', label: 'Posted' },
  { value: 'paid', label: 'Paid' },
];
const STAGE_LABEL: Record<DealStage, string> = { talking: 'Talking', agreed: 'Agreed', posted: 'Posted', paid: 'Paid' };
const CURRENCIES: Currency[] = ['USD', 'INR', 'EUR', 'GBP', 'CAD'];

const moneyFormats = new Map<string, Intl.NumberFormat>();
function money(amount: number, currency: string): string {
  let f = moneyFormats.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    moneyFormats.set(currency, f);
  }
  return f.format(amount || 0);
}

/** Today as YYYY-MM-DD in local time, comparable with the server's date strings */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Date-only strings parse as UTC; anchor them to local midnight so the day does not shift */
function formatDay(day?: string | null): string {
  if (!day) return '';
  return formatDate(/^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T00:00:00` : day);
}

function isOverdue(d: BrandDeal, today: string): boolean {
  return d.stage === 'posted' && !!d.due_date && d.due_date < today;
}

/** Sums amounts in the most common currency; reports whether other currencies were left out */
function summarize(deals: BrandDeal[]): { total: number; currency: Currency; mixed: boolean } {
  if (deals.length === 0) return { total: 0, currency: 'USD', mixed: false };
  const counts = new Map<Currency, number>();
  for (const d of deals) counts.set(d.currency, (counts.get(d.currency) || 0) + 1);
  let currency: Currency = deals[0].currency;
  for (const [c, n] of counts) if (n > (counts.get(currency) || 0)) currency = c;
  const total = deals.filter((d) => d.currency === currency).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  return { total, currency, mixed: counts.size > 1 };
}

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.sample)
    return 'The sample workspace is read-only. Sign in with your own channel to track deals.';
  return err instanceof Error && err.message ? err.message : fallback;
}

interface FormState {
  brand: string;
  contact: string;
  deliverable: string;
  amount: string;
  currency: Currency;
  stage: DealStage;
  post_date: string;
  due_date: string;
  notes: string;
}

function toForm(d?: BrandDeal | null): FormState {
  return {
    brand: d?.brand || '',
    contact: d?.contact || '',
    deliverable: d?.deliverable || '',
    amount: d ? String(d.amount ?? '') : '',
    currency: d?.currency || 'USD',
    stage: d?.stage || 'talking',
    post_date: d?.post_date || '',
    due_date: d?.due_date || '',
    notes: d?.notes || '',
  };
}

export const DealsTab: React.FC = () => {
  const [deals, setDeals] = useState<BrandDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [announce, setAnnounce] = useState('');
  const [editing, setEditing] = useState<BrandDeal | 'new' | null>(null);

  const load = async () => {
    try {
      const res = await api.deals.list();
      setDeals(res.deals);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Could not load your deals'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const today = todayIso();

  const stats = useMemo(() => {
    const by = (s: DealStage) => deals.filter((d) => d.stage === s);
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recentPaid = by('paid').filter((d) => {
      const t = new Date(d.paid_at || d.updated_at).getTime();
      return !Number.isNaN(t) && t >= cutoff;
    });
    return {
      talking: by('talking').length,
      agreed: summarize(by('agreed')),
      posted: summarize(by('posted')),
      overdue: by('posted').filter((d) => isOverdue(d, today)).length,
      paid: summarize(recentPaid),
    };
  }, [deals, today]);

  const move = async (deal: BrandDeal, stage: DealStage) => {
    const previous = deals;
    setDeals((cur) => cur.map((d) => (d.id === deal.id ? { ...d, stage } : d)));
    setError('');
    try {
      const res = await api.deals.update(deal.id, { stage });
      setDeals((cur) => cur.map((d) => (d.id === deal.id ? res.deal : d)));
      setAnnounce(`Moved ${deal.brand} to ${STAGE_LABEL[stage]}`);
    } catch (err) {
      setDeals(previous);
      setError(errorText(err, `Could not move ${deal.brand}`));
      setAnnounce(`Could not move ${deal.brand}`);
    }
  };

  const remove = async (deal: BrandDeal) => {
    if (!window.confirm(`Delete the ${deal.brand} deal? This cannot be undone.`)) return;
    const previous = deals;
    setDeals((cur) => cur.filter((d) => d.id !== deal.id));
    setError('');
    try {
      await api.deals.remove(deal.id);
      setAnnounce(`Deleted ${deal.brand}`);
    } catch (err) {
      setDeals(previous);
      setError(errorText(err, `Could not delete ${deal.brand}`));
      setAnnounce(`Could not delete ${deal.brand}`);
    }
  };

  const saved = (deal: BrandDeal, created: boolean) => {
    setDeals((cur) => (created ? [deal, ...cur] : cur.map((d) => (d.id === deal.id ? deal : d))));
    setAnnounce(created ? `Added ${deal.brand}` : `Saved ${deal.brand}`);
    setEditing(null);
  };

  const statNote = (s: { mixed: boolean; currency: Currency }) =>
    s.mixed ? `${s.currency} deals only, other currencies left out` : undefined;

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div className="py-24 flex justify-center text-fg-3" role="status">
        <Spinner size={20} />
        <span className="sr-only">Loading deals</span>
      </div>
    );
  } else {
    body = (
      <>
        <PageHeader
          title="Brand deals"
          description="Every sponsorship from first email to paid invoice"
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <Plus {...ICON} />
              Add deal
            </button>
          }
        />

        {error && (
          <div className="mb-6">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {deals.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<Handshake {...ICON} />}
              title="No deals yet"
              description="Track each sponsorship as it moves from talking to agreed, posted and paid, so you always know what is owed and what is late."
              action={
                <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
                  <Plus {...ICON} />
                  Add your first deal
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Stat
                label="In talks"
                value={stats.talking}
                note={stats.talking === 1 ? '1 conversation' : `${stats.talking} conversations`}
              />
              <Stat
                label="Agreed, not yet posted"
                value={money(stats.agreed.total, stats.agreed.currency)}
                note={statNote(stats.agreed)}
              />
              <Stat
                label="Waiting for payment"
                value={money(stats.posted.total, stats.posted.currency)}
                tone={stats.overdue > 0 ? 'negative' : 'neutral'}
                note={
                  stats.overdue > 0
                    ? `${stats.overdue} overdue${stats.posted.mixed ? `, ${stats.posted.currency} deals only` : ''}`
                    : statNote(stats.posted)
                }
              />
              <Stat
                label="Paid in the last 90 days"
                value={money(stats.paid.total, stats.paid.currency)}
                note={statNote(stats.paid)}
              />
            </div>

            <h2 className="sr-only">Pipeline</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
              {STAGES.map((stage, i) => {
                const items = deals.filter((d) => d.stage === stage.value);
                const sum = summarize(items);
                const prev = STAGES[i - 1];
                const next = STAGES[i + 1];
                return (
                  <section
                    key={stage.value}
                    aria-label={`${stage.label}, ${items.length} deals`}
                    className="well rounded-[12px] p-3"
                  >
                    <SectionTitle
                      title={stage.label}
                      meta={<span className="num">{items.length}</span>}
                      action={
                        <span className="meta num">
                          {money(sum.total, sum.currency)}
                          {sum.mixed && <span className="sr-only"> in {sum.currency} deals only</span>}
                          {sum.mixed && <span aria-hidden="true">*</span>}
                        </span>
                      }
                    />
                    {items.length === 0 ? (
                      <p className="meta px-1 py-4 text-center">No deals here</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {items.map((d) => {
                          const overdue = isOverdue(d, today);
                          return (
                            <li key={d.id} className="card p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium text-fg truncate">{d.brand}</div>
                                  {d.deliverable && <div className="text-[13px] text-fg-2 mt-0.5">{d.deliverable}</div>}
                                </div>
                                <div className="num text-fg shrink-0">{money(d.amount, d.currency)}</div>
                              </div>
                              {(d.post_date || d.due_date || overdue) && (
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                  {d.post_date && <span className="meta num">Posts {formatDay(d.post_date)}</span>}
                                  {d.due_date && <span className="meta num">Due {formatDay(d.due_date)}</span>}
                                  {overdue && <span className="tag text-negative">Overdue</span>}
                                </div>
                              )}
                              <div className="mt-3 flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setEditing(d)}
                                    aria-label={`Edit ${d.brand}`}
                                  >
                                    <Pencil {...ICON} />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => remove(d)}
                                    aria-label={`Delete ${d.brand}`}
                                  >
                                    <Trash2 {...ICON} />
                                    Delete
                                  </button>
                                </div>
                                <div className="flex items-center gap-1">
                                  {prev && (
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => move(d, prev.value)}
                                      aria-label={`Move ${d.brand} to ${prev.label}`}
                                      title={`Move to ${prev.label}`}
                                    >
                                      <ChevronLeft {...ICON} />
                                    </button>
                                  )}
                                  {next && (
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => move(d, next.value)}
                                      aria-label={`Move ${d.brand} to ${next.label}`}
                                      title={`Move to ${next.label}`}
                                    >
                                      <ChevronRight {...ICON} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {sum.mixed && <p className="meta mt-2 px-1">* Total counts {sum.currency} deals only</p>}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      {body}
      {editing && (
        <DealDialog deal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={saved} />
      )}
    </div>
  );
};

const DealDialog: React.FC<{
  deal: BrandDeal | null;
  onClose: () => void;
  onSaved: (deal: BrandDeal, created: boolean) => void;
}> = ({ deal, onClose, onSaved }) => {
  const [form, setForm] = useState<FormState>(() => toForm(deal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const brand = form.brand.trim();
    const amount = form.amount.trim() === '' ? 0 : Number(form.amount);
    if (!brand) return setError('Add the brand name.');
    if (!Number.isFinite(amount) || amount < 0) return setError('Amount must be zero or more.');
    const body: DealInput = {
      brand,
      contact: form.contact.trim(),
      deliverable: form.deliverable.trim(),
      amount,
      currency: form.currency,
      stage: form.stage,
      post_date: form.post_date || null,
      due_date: form.due_date || null,
      notes: form.notes.trim(),
    };
    setSaving(true);
    setError('');
    try {
      const res = deal ? await api.deals.update(deal.id, body) : await api.deals.create(body);
      onSaved(res.deal, !deal);
    } catch (err) {
      setError(errorText(err, 'Could not save this deal'));
      setSaving(false);
    }
  };

  const id = (name: string) => `deal-${name}`;

  return (
    <Dialog
      labelledBy="deal-dialog-title"
      onClose={onClose}
      className="card w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto"
    >
      <form onSubmit={submit} className="p-6 flex flex-col gap-4" noValidate>
        <h2 id="deal-dialog-title" className="text-[17px] font-medium text-fg">
          {deal ? `Edit ${deal.brand}` : 'Add deal'}
        </h2>

        <div>
          <label htmlFor={id('brand')} className="field-label">
            Brand
          </label>
          <input
            id={id('brand')}
            className="input"
            required
            maxLength={80}
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={id('contact')} className="field-label">
              Contact
            </label>
            <input
              id={id('contact')}
              className="input"
              value={form.contact}
              onChange={(e) => set('contact', e.target.value)}
              placeholder="Name or email"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor={id('deliverable')} className="field-label">
              Deliverable
            </label>
            <input
              id={id('deliverable')}
              className="input"
              value={form.deliverable}
              onChange={(e) => set('deliverable', e.target.value)}
              placeholder="60-second integration"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor={id('amount')} className="field-label">
              Amount
            </label>
            <input
              id={id('amount')}
              className="input num"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={id('currency')} className="field-label">
              Currency
            </label>
            <select
              id={id('currency')}
              className="input"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value as Currency)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={id('stage')} className="field-label">
              Stage
            </label>
            <select
              id={id('stage')}
              className="input"
              value={form.stage}
              onChange={(e) => set('stage', e.target.value as DealStage)}
            >
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={id('post')} className="field-label">
              Post date
            </label>
            <input
              id={id('post')}
              className="input num"
              type="date"
              value={form.post_date}
              onChange={(e) => set('post_date', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={id('due')} className="field-label">
              Payment due
            </label>
            <input
              id={id('due')}
              className="input num"
              type="date"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
              aria-describedby={id('due-hint')}
            />
            <p id={id('due-hint')} className="field-hint">
              Posted deals past this date show as overdue.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor={id('notes')} className="field-label">
            Notes
          </label>
          <textarea
            id={id('notes')}
            className="input min-h-[88px] py-2"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <Spinner />}
            {saving ? 'Saving' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
