'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SHORTCUT_PERCENTS = [10, 15, 20];

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function DiscountPicker({
  partyId,
  initial,
  initialAmountCents,
}: {
  partyId: string;
  initial: number;
  initialAmountCents: number;
}) {
  const router = useRouter();
  const [percent, setPercent] = useState<number>(initial);
  const [amountCents, setAmountCents] = useState<number>(initialAmountCents);
  // Live values for the two custom inputs. Pre-populated from saved state.
  const [pctInput, setPctInput] = useState<string>(initial > 0 ? String(initial) : '');
  const [dollarInput, setDollarInput] = useState<string>(
    initialAmountCents > 0 ? (initialAmountCents / 100).toFixed(2) : '',
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Which mode is currently saved on the server (for label clarity)
  const activeMode: 'none' | 'percent' | 'custom' =
    amountCents > 0 ? 'custom' : percent > 0 ? 'percent' : 'none';

  const save = async (
    payload: { percent: number } | { amount_cents: number },
    busyKey: string,
  ) => {
    if (busy) return false;
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

  const applyPercent = async (value: number) => {
    const ok = await save({ percent: value }, `pct-${value}`);
    if (ok) {
      setPercent(value);
      setAmountCents(0);
      setPctInput(value > 0 ? String(value) : '');
      setDollarInput('');
    }
  };

  const applyCustomPercent = async () => {
    const v = parseInt(pctInput, 10);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      setError('Enter a percent between 0 and 100.');
      return;
    }
    await applyPercent(v);
  };

  const applyCustomDollar = async () => {
    const dollars = parseFloat(dollarInput);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError('Enter a dollar amount (or 0 to clear).');
      return;
    }
    const cents = Math.round(dollars * 100);
    const ok = await save({ amount_cents: cents }, 'custom-$');
    if (ok) {
      setAmountCents(cents);
      setPercent(0);
      setPctInput('');
      setDollarInput(cents > 0 ? (cents / 100).toFixed(2) : '');
    }
  };

  const clear = () => applyPercent(0);

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Current
        </p>
        <p className="text-sm font-bold text-coral">
          {activeMode === 'none'
            ? 'No discount'
            : activeMode === 'percent'
              ? `${percent}% off`
              : `${fmt(amountCents)} off`}
        </p>
      </div>

      {/* Quick shortcut chips for the common percents */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clear}
          disabled={busy !== null}
          className={`rounded-full border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition disabled:cursor-not-allowed ${
            activeMode === 'none'
              ? 'border-coral bg-coral-50 text-coral'
              : 'border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          {busy === 'pct-0' ? '…' : 'None'}
        </button>
        {SHORTCUT_PERCENTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => applyPercent(p)}
            disabled={busy !== null}
            className={`rounded-full border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition disabled:cursor-not-allowed ${
              activeMode === 'percent' && percent === p
                ? 'border-coral bg-coral-50 text-coral'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {busy === `pct-${p}` ? '…' : `${p}%`}
          </button>
        ))}
      </div>

      {/* Two custom inputs side by side */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Custom %
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="number"
              onFocus={(e) => e.currentTarget.select()}
              min={0}
              max={100}
              step={1}
              value={pctInput}
              onChange={(e) => setPctInput(e.target.value)}
              placeholder="e.g. 25"
              style={{ width: 72 }}
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-sm font-semibold text-slate-700 focus:border-coral focus:outline-none"
            />
            <span className="text-sm text-slate-400">%</span>
            <button
              type="button"
              onClick={applyCustomPercent}
              disabled={busy !== null}
              className="ml-auto rounded-full bg-coral px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:opacity-50"
            >
              {busy === 'pct-custom' ? '…' : 'Apply'}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">Scales with add-ons.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Custom $
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-sm text-slate-400">$</span>
            <input
              type="number"
              onFocus={(e) => e.currentTarget.select()}
              min={0}
              step={0.01}
              value={dollarInput}
              onChange={(e) => setDollarInput(e.target.value)}
              placeholder="e.g. 50"
              style={{ width: 88 }}
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-sm font-semibold text-slate-700 focus:border-coral focus:outline-none"
            />
            <button
              type="button"
              onClick={applyCustomDollar}
              disabled={busy !== null}
              className="ml-auto rounded-full bg-coral px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:opacity-50"
            >
              {busy === 'custom-$' ? '…' : 'Apply'}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">Fixed amount.</p>
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-coral-700">{error}</p>}
    </div>
  );
}
