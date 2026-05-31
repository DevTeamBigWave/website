'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Kind = 'skip_deposit' | 'percent_off';
type Channel = 'online' | 'admin' | 'both';
type Context = 'party' | 'open_play' | 'membership' | 'gift_card';

const CONTEXTS: Array<{ value: Context; label: string }> = [
  { value: 'party', label: 'Birthday parties' },
  { value: 'open_play', label: 'Open play' },
  { value: 'membership', label: 'Memberships' },
  { value: 'gift_card', label: 'Gift cards' },
];

// Default expiration: 30 days from today, NYC.
function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function PromoCodeBuilder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<Kind>('percent_off');
  const [discountPercent, setDiscountPercent] = useState('20');
  const [appliesTo, setAppliesTo] = useState<Context[]>(['party']);
  const [channel, setChannel] = useState<Channel>('online');
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [maxUses, setMaxUses] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setLabel('');
    setCode('');
    setKind('percent_off');
    setDiscountPercent('20');
    setAppliesTo(['party']);
    setChannel('online');
    setValidUntil(defaultValidUntil());
    setMaxUses('');
    setNotes('');
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!label.trim()) {
      setError('Add a label so you can recognize this code later.');
      return;
    }
    if (kind === 'percent_off') {
      const pct = parseInt(discountPercent, 10);
      if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
        setError('Discount % must be 1–100.');
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/promo-codes/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: code.trim() || undefined,
          label: label.trim(),
          kind,
          discount_percent:
            kind === 'percent_off' ? parseInt(discountPercent, 10) : undefined,
          applies_to: appliesTo.length > 0 ? appliesTo : undefined,
          channel,
          valid_until: validUntil,
          max_uses: maxUses ? parseInt(maxUses, 10) : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Could not create code (${res.status})`);
      } else {
        setSuccess(`Created ${data.code} ✓`);
        reset();
        router.refresh();
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  const togglesContext = (c: Context) =>
    setAppliesTo((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-coral px-5 py-2 text-sm font-bold text-white shadow-playful hover:bg-coral-600"
      >
        + Build a custom code
      </button>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-coral bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-lg text-slate-700">Build a custom promo code</h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
            setError(null);
            setSuccess(null);
          }}
          className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-coral"
        >
          Cancel
        </button>
      </div>

      <div className="space-y-4">
        <Field label="Label (so you remember what this is for) *">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            placeholder="e.g. June 20% off parties, Influencer Sarah, Repeat customer Mike"
            className={inputCls}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code (leave blank to auto-generate)">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              maxLength={40}
              placeholder="JUNE20"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field label="Kind *">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className={inputCls}
            >
              <option value="percent_off">Percent off</option>
              <option value="skip_deposit">Skip deposit</option>
            </select>
          </Field>
        </div>

        {kind === 'percent_off' && (
          <Field label="Discount % *">
            <input
              type="number"
              min={1}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              className={`${inputCls} max-w-[100px]`}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Comes off the party price only — add-ons stay at full price.
              Customers apply it on the /book page; deposit + total adjust
              automatically. Only party bookings honor it today (open play /
              membership / gift-card codes can be created and the builder
              will validate scope, but those checkouts don't auto-apply
              the discount yet).
            </p>
          </Field>
        )}

        <Field label="Applies to (leave all unchecked to apply everywhere)">
          <div className="mt-2 flex flex-wrap gap-2">
            {CONTEXTS.map((c) => {
              const active = appliesTo.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => togglesContext(c.value)}
                  className={`rounded-full border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                    active
                      ? 'border-coral bg-coral text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-coral'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Channel *">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className={inputCls}
            >
              <option value="online">Online (customer-entered)</option>
              <option value="admin">Phone / in-person (admin-only)</option>
              <option value="both">Both</option>
            </select>
          </Field>
          <Field label="Expires *">
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Max uses (blank = unlimited)">
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="e.g. 25"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Internal notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Why this code exists, who it's for, anything to remember"
            className={inputCls}
          />
        </Field>

        {error && <p className="text-sm font-semibold text-coral-700">{error}</p>}
        {success && <p className="text-sm font-semibold text-emerald-700">{success}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-full bg-coral px-6 py-2 text-sm font-bold text-white shadow-playful hover:bg-coral-600 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create code'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
