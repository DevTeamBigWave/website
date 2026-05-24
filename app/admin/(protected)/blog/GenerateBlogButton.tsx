'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GenerateBlogButton({
  defaultCount,
  label,
  variant = 'default',
}: {
  defaultCount: number;
  label: string;
  variant?: 'default' | 'accent';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const onClick = async () => {
    if (busy) return;
    if (!confirm(`Generate ${defaultCount} blog post${defaultCount === 1 ? '' : 's'} now? This takes ~30-90 seconds.`)) {
      return;
    }
    setBusy(true);
    setStatus('Generating…');
    try {
      const res = await fetch('/api/admin/blog/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ count: defaultCount }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus(`Error: ${data.error ?? 'failed'}`);
        setBusy(false);
        return;
      }
      setStatus(`Published ${data.generated}.`);
      router.refresh();
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const cls =
    variant === 'accent'
      ? 'bg-coral text-white hover:bg-coral-600'
      : 'bg-slate-700 text-white hover:bg-slate-600';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`rounded-full px-4 py-2 text-sm font-bold shadow-card transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
      >
        {busy ? 'Generating…' : label}
      </button>
      {status && <p className="text-xs text-slate-500">{status}</p>}
    </div>
  );
}
