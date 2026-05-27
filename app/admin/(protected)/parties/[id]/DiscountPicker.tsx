'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Percent = 0 | 10 | 15 | 20;

const PERCENT_OPTIONS: Array<{ value: Percent; label: string }> = [
  { value: 0, label: 'None' },
  { value: 10, label: '10% off' },
  { value: 15, label: '15% off' },
  { value: 20, label: '20% off' },
];

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function DiscountPicker({
  partyId,
  initial,
  initialAmountCents,
}: {
  partyId: string;
  initial: Percent;
  initialAmountCents: number;
}) {
  const router = useRouter();
  // Active discount mode: 'percent' if a percent is set, 'custom' if a $ is set
  const activeMode: 'percent' | 'custom' =
    initialAmountCents > 0 ? 'custom' : 'percent';
  const [percent, setPercent] = useState<Percent>(initial);
  const [amountCents, setAmountCents] = useState<number>(initialAmountCents);
  const [customOpen, setCustomOpen] = useState(activeMode === 'custom');
  const [customInput, setCustomInput] = useState(
    initialAmountCents > 0 ? (initialAmountCents / 100).toFixed(2) : '',
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (
    payload: { percent: Percent } | { amount_cents: number },
    busyKey: string,
  ) => {
    setBusy(busyKey);
    setError(null);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/discount`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not save');
        return false;
      }
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const pickPercent = async (next: Percent) => {
    if (busy || (activeMode === 'percent' && next === percent)) return;
    const prev = percent;
    setPercent(next);
    setAmountCents(0);
    setCustomOpen(false);
    const ok = await save({ percent: next }, `pct-${next}`);
    if (!ok) setPercent(prev);
  };

  const applyCustom = async () => {
    if (busy) return;
    const dollars = parseFloat(customInput);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError('Enter a dollar amount (or 0 to clear).');
      return;
    }
    const cents = Math.round(dollars * 100);
    const ok = await save({ amount_cents: cents }, 'custom');
    if (ok) {
      setAmountCents(cents);
      setPercent(0);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {PERCENT_OPTIONS.map((o) => {
          const active = activeMode === 'percent' && o.value === percent;
          const isBusy = busy === `pct-${o.value}`;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pickPercent(o.value)}
              disabled={busy !== null}
              className={`rounded-2xl border-2 px-2 py-3 text-center transition disabled:cursor-not-allowed ${
                active
                  ? 'border-coral bg-coral-50 shadow-card'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className={`font-display text-base ${active ? 'text-coral' : 'text-slate-700'}`}>
                {isBusy ? '…' : o.label}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-2">
        {!customOpen ? (
          <button
            type="button"
            onClick={() => {
              setCustomOpen(true);
              setError(null);
            }}
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500 underline hover:text-coral"
          >
            {activeMode === 'custom'
              ? `Custom: ${fmt(amountCents)} off · edit`
              : 'Custom $ amount?'}
          </button>
        ) : (
          <div
            className={`mt-2 space-y-2 rounded-2xl border-2 p-3 ${
              activeMode === 'custom' ? 'border-coral bg-coral-50 shadow-card' : 'border-coral bg-coral-50/40'
            }`}
          >
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Custom discount amount
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-sm text-slate-400">$</span>
                <input
                  type="number"
                  onFocus={(e) => e.currentTarget.select()}
                  step="0.01"
                  min="0"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g. 50.00"
                  style={{ width: 96 }}
                  className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-sm font-semibold text-slate-700 focus:border-coral focus:outline-none"
                />
                <span className="ml-1 text-[11px] text-slate-500">off the grand total</span>
              </div>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyCustom}
                disabled={busy !== null}
                className="rounded-full bg-coral px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:opacity-50"
              >
                {busy === 'custom' ? 'Saving…' : 'Apply'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomOpen(false);
                  setCustomInput(initialAmountCents > 0 ? (initialAmountCents / 100).toFixed(2) : '');
                  setError(null);
                }}
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 underline hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-coral-700">{error}</p>}
    </div>
  );
}
