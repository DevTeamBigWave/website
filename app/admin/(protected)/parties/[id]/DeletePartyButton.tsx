'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeletePartyButton({ partyId }: { partyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (busy) return;
    if (
      !confirm(
        'Delete this party? Any open Stripe invoice will be voided. This cannot be undone.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/delete`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not delete');
        return;
      }
      router.push('/admin/parties');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:border-red-400 hover:text-red-600 disabled:opacity-50"
      >
        {busy ? 'Deleting…' : '🗑 Delete party'}
      </button>
      {error && <span className="text-xs text-coral-700">{error}</span>}
    </div>
  );
}
