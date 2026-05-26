'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GeneratePromoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (busy) return;
    if (
      !confirm(
        'Generate a new promo code for this month? Any existing code stays valid until its expiration.',
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
      setIssued(data.code);
      router.refresh();
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
        {busy ? 'Generating…' : 'Generate new code'}
      </button>
      {issued && (
        <p className="text-xs text-coral-700">
          Issued: <span className="font-mono font-bold">{issued}</span>
        </p>
      )}
      {error && <p className="text-xs text-coral-700">{error}</p>}
    </div>
  );
}
