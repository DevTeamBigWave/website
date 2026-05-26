'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const OPTIONS: Array<{ value: 0 | 10 | 15 | 20; label: string }> = [
  { value: 0, label: 'None' },
  { value: 10, label: '10% off' },
  { value: 15, label: '15% off' },
  { value: 20, label: '20% off' },
];

export function DiscountPicker({
  partyId,
  initial,
}: {
  partyId: string;
  initial: 0 | 10 | 15 | 20;
}) {
  const router = useRouter();
  const [percent, setPercent] = useState<0 | 10 | 15 | 20>(initial);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (next: 0 | 10 | 15 | 20) => {
    if (saving !== null || next === percent) return;
    const prev = percent;
    setPercent(next);
    setSaving(next);
    setError(null);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/discount`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ percent: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not save');
        setPercent(prev);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setPercent(prev);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {OPTIONS.map((o) => {
          const active = o.value === percent;
          const busy = saving === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              disabled={saving !== null}
              className={`rounded-2xl border-2 px-2 py-3 text-center transition disabled:cursor-not-allowed ${
                active
                  ? 'border-coral bg-coral-50 shadow-card'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className={`font-display text-base ${active ? 'text-coral' : 'text-slate-700'}`}>
                {busy ? '…' : o.label}
              </p>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 text-xs text-coral-700">{error}</p>}
    </div>
  );
}
