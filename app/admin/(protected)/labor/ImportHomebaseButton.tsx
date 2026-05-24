'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ImportHomebaseButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    if (!confirm('Pull the last 7 days of Homebase daily emails and parse them?')) return;
    setBusy(true);
    setFeedback('Importing… (~10-30s)');
    try {
      const res = await fetch('/api/admin/homebase/import', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(`Error: ${data.error ?? 'unknown'}`);
        setBusy(false);
        return;
      }
      const errorsNote = data.errors?.length ? ` · ${data.errors.length} errors` : '';
      setFeedback(
        `Found ${data.emails_found} · imported ${data.imported} · skipped ${data.skipped}${errorsNote}`,
      );
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'unknown');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-playful hover:bg-coral-600 disabled:opacity-50"
      >
        {busy ? 'Importing…' : 'Import now'}
      </button>
      {feedback && <p className="text-xs text-slate-500">{feedback}</p>}
    </div>
  );
}
