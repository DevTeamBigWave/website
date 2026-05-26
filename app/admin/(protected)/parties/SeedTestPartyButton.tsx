'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SeedTestPartyButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seed = async () => {
    if (busy) return;
    if (
      !confirm(
        'Seed a test party with deposit already paid? It will use your own email so you can receive the test invoice email.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/test/seed-party', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.partyId) {
        setError(data.error ?? 'Could not seed');
        return;
      }
      router.push(`/admin/parties/${data.partyId}`);
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
        onClick={seed}
        disabled={busy}
        className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:border-coral hover:text-coral disabled:opacity-50"
        title="Creates a confirmed party with deposit paid, using your own email"
      >
        {busy ? 'Seeding…' : '🧪 Seed test party'}
      </button>
      {error && <span className="text-xs text-coral-700">{error}</span>}
    </div>
  );
}
