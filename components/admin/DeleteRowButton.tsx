'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteRowButton({
  endpoint,
  confirmMessage,
  label = '🗑',
  fullSize = false,
}: {
  endpoint: string;
  confirmMessage: string;
  label?: string;
  fullSize?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Delete failed: ${data.error ?? res.statusText}`);
        return;
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  if (fullSize) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:border-red-400 hover:text-red-600 disabled:opacity-50"
      >
        {busy ? 'Deleting…' : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Delete"
      aria-label="Delete"
      className="rounded-md p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
    >
      {busy ? '…' : label}
    </button>
  );
}
