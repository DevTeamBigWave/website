'use client';

import { useState } from 'react';

type AppliedCard = {
  code: string;
  balanceCents: number;
};

export function GiftCardInput({
  appliedCard,
  onApply,
  onClear,
  maxApplyCents,
}: {
  appliedCard: AppliedCard | null;
  onApply: (card: AppliedCard) => void;
  onClear: () => void;
  // The most that can actually come off this booking (i.e. cap at the order total)
  maxApplyCents: number;
}) {
  const [open, setOpen] = useState(appliedCard != null);
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    if (!code.trim()) return;
    setValidating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/gift-cards/validate?code=${encodeURIComponent(code.trim())}`,
      );
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setError(data.error ?? 'Invalid code.');
        setValidating(false);
        return;
      }
      onApply({ code: data.code, balanceCents: data.balanceCents });
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setValidating(false);
    }
  };

  if (appliedCard) {
    const used = Math.min(appliedCard.balanceCents, maxApplyCents);
    const leftover = appliedCard.balanceCents - used;
    return (
      <div className="rounded-2xl border border-coral-200 bg-coral-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-coral-700">
              Gift card applied
            </p>
            <p className="mt-1 font-mono text-sm text-slate-700">{appliedCard.code}</p>
            <p className="mt-1 text-sm text-slate-600">
              −${(used / 100).toFixed(2)} off this booking
              {leftover > 0 && (
                <span className="text-slate-400">
                  {' '}
                  · ${(leftover / 100).toFixed(2)} left for next time
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-coral hover:text-coral-700"
      >
        + Got a gift card?
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <label className="block flex-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Gift card code
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="WP-XXXX-XXXX"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm uppercase focus:border-coral focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
          />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-coral-700">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCode('');
            setError(null);
          }}
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:border-slate-400"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={validating || !code.trim()}
          className="rounded-full bg-coral px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-playful hover:bg-coral-600 disabled:opacity-50"
        >
          {validating ? 'Checking…' : 'Apply'}
        </button>
      </div>
    </div>
  );
}
