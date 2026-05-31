'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DisableButton({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const click = async () => {
    if (!confirm(`Disable code ${code}? It'll stop validating immediately. This cannot be undone via the UI.`)) {
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/admin/promo-codes/${id}/disable`, { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      className="text-[10px] font-bold uppercase tracking-wider text-slate-400 underline hover:text-coral-700 disabled:opacity-50"
    >
      {busy ? '…' : 'Disable'}
    </button>
  );
}
