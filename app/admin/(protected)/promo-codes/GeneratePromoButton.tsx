'use client';

import { useState } from 'react';

export function GeneratePromoButton() {
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{
    code: string;
    valid_until: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (busy) return;
    if (
      !confirm(
        'Generate a new skip-deposit promo code for this month? Any existing code stays valid until its expiration.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/promo-codes/generate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed');
        return;
      }
      setIssued({ code: data.code, valid_until: data.valid_until });
      // Hard reload — router.refresh() can be flaky when the row was just
      // inserted (server-component cache, edge timestamp races). One full
      // reload guarantees the new code appears in the Active section.
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-full bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-600 disabled:opacity-50"
      >
        {busy ? 'Generating…' : 'Generate skip-deposit code'}
      </button>
      {issued && (
        <p className="text-xs text-emerald-700">
          ✓ Skip-deposit code created · valid through{' '}
          {new Date(issued.valid_until).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
          . Refreshing…
        </p>
      )}
      {error && <p className="text-xs text-coral-700">{error}</p>}
    </div>
  );
}
